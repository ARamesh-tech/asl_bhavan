import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { MessageActions } from "@/components/admin/message-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { prisma } from "@/lib/db/prisma";
import { telLink, whatsappLink } from "@/lib/whatsapp";
import { cn } from "cn";

export const metadata: Metadata = { title: "Messages" };
const PAGE_SIZE = 20;
const STATUSES = ["NEW", "READ", "RESOLVED"] as const;

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = status ? { status } : {};
  const [rows, total, counts] = await Promise.all([
    prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <AdminPageHeader title="Messages" description="Enquiries from the website contact form." />
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2">
        {[{ id: undefined, label: "All" }, ...STATUSES.map((s) => ({ id: s, label: `${s[0]}${s.slice(1).toLowerCase()} (${count(s)})` }))].map((f) => (
          <Link key={f.label} href={f.id ? `/admin/messages?status=${f.id}` : "/admin/messages"} aria-current={status === f.id ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", status === f.id ? "border-brand bg-brand text-white" : "hover:bg-muted")}>{f.label}</Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">No messages here.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((m) => (
            <li key={m.id} className={cn("rounded-2xl border bg-card p-5 shadow-soft", m.status === "NEW" && "border-brand/40")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{m.name} <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-medium", m.status === "NEW" ? "bg-brand-soft text-brand-deep" : m.status === "RESOLVED" ? "bg-status-available-soft text-status-available" : "bg-muted text-muted-foreground")}>{m.status.toLowerCase()}</span></p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="size-3.5" aria-hidden />{m.email}</a>
                    {m.phone && <a href={telLink(m.phone)} className="inline-flex items-center gap-1 hover:underline"><Phone className="size-3.5" aria-hidden />{m.phone}</a>}
                    {m.phone && <a href={whatsappLink(m.phone, `Hello ${m.name}, thank you for contacting us.`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline"><MessageCircle className="size-3.5" aria-hidden />WhatsApp</a>}
                  </p>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={m.createdAt.toISOString()}>{m.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
              <div className="mt-4"><MessageActions id={m.id} status={m.status} notes={m.adminNotes} /></div>
            </li>
          ))}
        </ul>
      )}
      <PaginationNav page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} basePath="/admin/messages" params={{ status }} className="mt-6" />
    </>
  );
}
