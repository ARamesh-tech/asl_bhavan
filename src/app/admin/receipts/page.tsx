import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Mail, RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Receipts" };
const PAGE_SIZES = [20, 50, 100];

export default async function AdminReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = PAGE_SIZES.includes(Number(sp.pageSize)) ? Number(sp.pageSize) : 20;

  const where: Prisma.ReceiptWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { receiptNumber: { contains: q.toUpperCase() } },
            { booking: { bookingReference: { contains: q.toUpperCase() } } },
            { booking: { guestName: { contains: q, mode: "insensitive" } } },
            { booking: { guestEmail: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total, missing] = await Promise.all([
    prisma.receipt.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        booking: { select: { id: true, bookingReference: true, guestName: true, guestEmail: true, paymentStatus: true } },
        generatedBy: { select: { name: true } },
        emailLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, sentAt: true, createdAt: true } },
      },
    }),
    prisma.receipt.count({ where }),
    prisma.booking.findMany({
      where: { deletedAt: null, receipt: null, status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] }, paymentStatus: { in: ["PAID", "CASH", "DIRECT_UPI", "BANK_TRANSFER"] } },
      orderBy: { confirmedAt: "desc" },
      take: 10,
      select: { id: true, bookingReference: true, guestName: true, totalAmount: true, currency: true },
    }),
  ]);

  return (
    <>
      <AdminPageHeader title="Receipts" description="Sequential receipts (ASL-RCP-YYYYMMDD-0001) are issued once per booking and never renumbered." />

      {missing.length > 0 && (
        <section className="mb-6 rounded-2xl border border-status-partial/40 bg-status-partial-soft/40 p-5">
          <h2 className="font-semibold">Paid bookings without a receipt</h2>
          <ul className="mt-3 divide-y text-sm">
            {missing.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><Link href={`/admin/bookings/${b.id}`} className="font-mono text-brand hover:underline">{b.bookingReference}</Link> · {b.guestName} · {formatMoney(b.totalAmount.toNumber(), b.currency)}</span>
                <ActionButton url="/api/admin/receipts" json={{ bookingId: b.id }} successMessage="Receipt issued" size="sm"><FileText aria-hidden /> Issue receipt</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form method="get" className="mb-4 flex flex-wrap gap-3 rounded-2xl border bg-card p-4 shadow-soft">
        <input name="q" defaultValue={q} placeholder="Search receipt no., booking, guest…" className="h-10 min-w-64 flex-1 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Search receipts" />
        <select name="pageSize" defaultValue={String(pageSize)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Rows per page">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-medium text-white">Search</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Receipt</th>
              <th className="px-4 py-3 font-semibold">Issued</th>
              <th className="px-4 py-3 font-semibold">Booking</th>
              <th className="px-4 py-3 font-semibold">Guest</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Last email</th>
              <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No receipts yet.</td></tr>}
            {rows.map((r) => {
              const last = r.emailLogs[0];
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-3 font-mono"><a href={`/api/receipts/${r.receiptNumber}/pdf`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{r.receiptNumber}</a></td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.issuedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}{r.generatedBy && <span className="block text-xs">by {r.generatedBy.name}</span>}</td>
                  <td className="px-4 py-3"><Link href={`/admin/bookings/${r.booking.id}`} className="font-mono text-brand hover:underline">{r.booking.bookingReference}</Link></td>
                  <td className="px-4 py-3">{r.booking.guestName}<span className="block text-xs text-muted-foreground">{r.booking.guestEmail}</span></td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatMoney(r.totalAmount.toNumber(), r.currency)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {last ? <>{last.status.toLowerCase()} · {(last.sentAt ?? last.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</> : "never sent"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <ActionButton url={`/api/admin/receipts/${r.id}`} json={{ action: "EMAIL" }} successMessage="Receipt emailed" variant="ghost" size="sm"><Mail aria-hidden /> Email</ActionButton>
                      <ActionButton url={`/api/admin/receipts/${r.id}`} json={{ action: "REGENERATE" }} successMessage="PDF regenerated" variant="ghost" size="sm"><RefreshCw aria-hidden /> Re-render</ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationNav page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} basePath="/admin/receipts" params={{ q: q || undefined, pageSize: pageSize === 20 ? undefined : String(pageSize) }} className="mt-6" />
    </>
  );
}
