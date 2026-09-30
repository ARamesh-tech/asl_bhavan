import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import type { EmailStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { integrations } from "@/lib/env";
import { cn } from "cn";

export const metadata: Metadata = { title: "Emails" };
const STATUSES: EmailStatus[] = ["PENDING", "SENT", "FAILED"];
const RESENDABLE = new Set(["booking-request", "booking-confirmed", "booking-cancelled", "owner-new-booking", "receipt"]);
const PAGE_SIZE = 50;

export default async function AdminEmailsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.EmailLogWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ to: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }, { template: { contains: q } }] } : {}),
  };
  const [rows, total, counts] = await Promise.all([
    prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { booking: { select: { id: true, bookingReference: true } } } }),
    prisma.emailLog.count({ where }),
    prisma.emailLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: EmailStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const configured = integrations().email;

  return (
    <>
      <AdminPageHeader title="Emails" description="Delivery log for every email the system sends. Failed booking and receipt emails can be resent." />
      {!configured && (
        <p className="mb-4 rounded-2xl border border-status-partial/40 bg-status-partial-soft/40 p-4 text-sm">Email delivery is not configured. Set <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code> in the environment to enable sending.</p>
      )}
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2">
        {[{ id: undefined, label: "All" }, ...STATUSES.map((s) => ({ id: s, label: `${s[0]}${s.slice(1).toLowerCase()} (${count(s)})` }))].map((f) => (
          <Link key={f.label} href={f.id ? `/admin/emails?status=${f.id}` : "/admin/emails"} aria-current={status === f.id ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", status === f.id ? "border-brand bg-brand text-white" : "hover:bg-muted")}>{f.label}</Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search recipient or subject" className="h-8 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Search emails" />
          <button type="submit" className="h-8 rounded-lg border px-3 text-sm">Search</button>
        </form>
      </nav>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">To</th>
              <th className="px-4 py-3 font-semibold">Subject</th>
              <th className="px-4 py-3 font-semibold">Template</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No emails logged.</td></tr>}
            {rows.map((e) => (
              <tr key={e.id} className="border-t align-top">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                <td className="px-4 py-3">{e.to}</td>
                <td className="px-4 py-3">{e.subject}{e.booking && <Link href={`/admin/bookings/${e.booking.id}`} className="block font-mono text-xs text-brand hover:underline">{e.booking.bookingReference}</Link>}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.template}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", e.status === "SENT" ? "bg-status-available-soft text-status-available" : e.status === "FAILED" ? "bg-status-booked-soft text-status-booked" : "bg-muted text-muted-foreground")}>{e.status.toLowerCase()}</span>
                  {e.attempts > 1 && <span className="ml-1 text-xs text-muted-foreground">×{e.attempts}</span>}
                  {e.error && <p className="mt-1 max-w-72 truncate text-xs text-destructive" title={e.error}>{e.error}</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  {e.status === "FAILED" && RESENDABLE.has(e.template) && (
                    <ActionButton url={`/api/admin/emails/${e.id}/resend`} successMessage="Email resent" variant="ghost" size="sm"><RotateCcw aria-hidden /> Resend</ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationNav page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} basePath="/admin/emails" params={{ status, q: q || undefined }} className="mt-6" />
    </>
  );
}
