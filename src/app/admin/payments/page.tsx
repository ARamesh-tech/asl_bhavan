import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, StatCard } from "@/components/admin/page-header";
import { RefundDialog } from "@/components/admin/refund-dialog";
import { PaymentStatusBadge } from "@/components/booking/status-badge";
import { PaginationNav } from "@/components/layout/pagination-nav";
import type { PaymentMethod, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { daysAgo, todayInTimeZone } from "@/lib/booking/dates";
import { PAYMENT_STATUS_LABELS } from "@/lib/booking/status";
import { prisma } from "@/lib/db/prisma";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/validation/admin";
import { cn } from "cn";

export const metadata: Metadata = { title: "Payments" };

const STATUSES: PaymentStatus[] = ["PENDING", "PAID", "PARTIAL", "FAILED", "REFUNDED", "CASH", "DIRECT_UPI", "BANK_TRANSFER", "PAY_ON_ARRIVAL"];
const PAGE_SIZES = [20, 50, 100];

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const method = (PAYMENT_METHODS as readonly string[]).includes(String(sp.method)) ? (sp.method as PaymentMethod) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = PAGE_SIZES.includes(Number(sp.pageSize)) ? Number(sp.pageSize) : 20;

  const where: Prisma.PaymentWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(q
      ? {
          OR: [
            { transactionId: { contains: q, mode: "insensitive" } },
            { razorpayPaymentId: { contains: q, mode: "insensitive" } },
            { razorpayOrderId: { contains: q, mode: "insensitive" } },
            { booking: { bookingReference: { contains: q.toUpperCase() } } },
            { booking: { guestName: { contains: q, mode: "insensitive" } } },
            { booking: { guestEmail: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const today = todayInTimeZone();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [rows, total, monthAgg, pendingOnline, needsAttention] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { booking: { select: { id: true, bookingReference: true, guestName: true, status: true, currency: true } }, recordedBy: { select: { name: true } } },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { deletedAt: null, paidAt: { gte: monthStart }, status: { in: ["PAID", "CASH", "DIRECT_UPI", "BANK_TRANSFER", "PARTIAL"] } }, _sum: { amount: true, refundedAmount: true }, _count: { _all: true } }),
    prisma.payment.count({ where: { deletedAt: null, method: "RAZORPAY", status: "PENDING" } }),
    prisma.auditLog.count({ where: { action: "SYSTEM_PAYMENT_NEEDS_ATTENTION", createdAt: { gte: daysAgo(30) } } }),
  ]);

  const monthNet = (monthAgg._sum.amount?.toNumber() ?? 0) - (monthAgg._sum.refundedAmount?.toNumber() ?? 0);

  return (
    <>
      <AdminPageHeader title="Payments" description="Every payment recorded against a booking — online (Razorpay) and manual." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected this month" value={formatMoney(monthNet, "INR")} hint={`${monthAgg._count._all} payments, net of refunds`} />
        <StatCard label="Open online orders" value={String(pendingOnline)} hint="Razorpay orders awaiting capture" />
        <StatCard label="Needs attention (30d)" value={String(needsAttention)} hint={needsAttention > 0 ? <Link href="/admin/audit-logs?action=SYSTEM_PAYMENT_NEEDS_ATTENTION" className="underline">Review in audit logs</Link> : "Nothing flagged"} />
      </div>

      <form method="get" className="mb-4 grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <input name="q" defaultValue={q} placeholder="Search reference, guest, txn id…" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Search payments" />
        <select name="status" defaultValue={status ?? ""} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="method" defaultValue={method ?? ""} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Method">
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
        </select>
        <select name="pageSize" defaultValue={String(pageSize)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Rows per page">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-medium text-white">Filter</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Booking</th>
              <th className="px-4 py-3 font-semibold">Guest</th>
              <th className="px-4 py-3 font-semibold">Method</th>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No payments match these filters.</td></tr>
            )}
            {rows.map((p) => {
              const refunded = p.refundedAmount.toNumber();
              const remaining = p.amount.toNumber() - refunded;
              const refundable = p.method === "RAZORPAY" && p.status === "PAID" && !!p.razorpayPaymentId && remaining > 0;
              return (
                <tr key={p.id} className="border-t align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{(p.paidAt ?? p.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                  <td className="px-4 py-3"><Link href={`/admin/bookings/${p.booking.id}`} className="font-mono text-brand hover:underline">{p.booking.bookingReference}</Link></td>
                  <td className="px-4 py-3">{p.booking.guestName}</td>
                  <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[p.method]}{p.recordedBy && <span className="block text-xs text-muted-foreground">by {p.recordedBy.name}</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.razorpayPaymentId ?? p.transactionId ?? "—"}{p.failureReason && <span className="block max-w-56 truncate text-destructive" title={p.failureReason}>{p.failureReason}</span>}</td>
                  <td className="px-4 py-3"><PaymentStatusBadge status={p.status} />{refunded > 0 && <span className={cn("block text-xs text-muted-foreground")}>refunded {formatMoney(refunded, p.currency)}</span>}</td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatMoney(p.amount.toNumber(), p.currency)}</td>
                  <td className="px-4 py-3 text-right">{refundable && <RefundDialog paymentId={p.id} remaining={remaining} currency={p.currency} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationNav page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} basePath="/admin/payments" params={{ q: q || undefined, status, method, pageSize: pageSize === 20 ? undefined : String(pageSize) }} className="mt-6" />
    </>
  );
}
