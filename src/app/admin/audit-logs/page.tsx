import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { auditLogFilterSchema } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Audit logs" };

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  Booking: (id) => `/admin/bookings/${id}`,
  Room: (id) => `/admin/rooms/${id}`,
};

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const parsed = auditLogFilterSchema.safeParse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const f = parsed.success ? parsed.data : auditLogFilterSchema.parse({});
  const where = {
    ...(f.action ? { action: { contains: f.action.toUpperCase() } } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
    ...(f.entityId ? { entityId: f.entityId } : {}),
    ...(f.adminUserId ? { adminUserId: f.adminUserId } : {}),
  };
  const [rows, total, actions] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * f.pageSize, take: f.pageSize, include: { adminUser: { select: { name: true, email: true } } } }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const select = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

  return (
    <>
      <AdminPageHeader title="Audit logs" description="Every admin and system action, with before/after snapshots. Secrets and password hashes are never stored." />
      <form method="get" className="mb-4 grid gap-3 rounded-2xl border bg-card p-4 shadow-soft md:grid-cols-5">
        <select name="action" defaultValue={f.action ?? ""} className={select} aria-label="Action">
          <option value="">Any action</option>
          {actions.map((a) => <option key={a.action} value={a.action}>{a.action}</option>)}
        </select>
        <Input name="entityType" defaultValue={f.entityType ?? ""} placeholder="Entity type (Booking, Room…)" className="h-10" aria-label="Entity type" />
        <Input name="entityId" defaultValue={f.entityId ?? ""} placeholder="Entity id" className="h-10 font-mono text-xs" aria-label="Entity id" />
        <select name="pageSize" defaultValue={String(f.pageSize)} className={select} aria-label="Page size"><option value="20">20</option><option value="50">50</option><option value="100">100</option></select>
        <div className="flex gap-2"><Button type="submit" className="h-10">Filter</Button><Button asChild variant="ghost" className="h-10"><Link href="/admin/audit-logs">Clear</Link></Button></div>
      </form>
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries match.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Change</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const link = r.entityId && ENTITY_LINKS[r.entityType]?.(r.entityId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</TableCell>
                      <TableCell className="text-sm">{r.adminUser ? <span title={r.adminUser.email}>{r.adminUser.name}</span> : <span className="text-muted-foreground">system</span>}{r.ipAddress && <span className="block font-mono text-[10px] text-muted-foreground">{r.ipAddress}</span>}</TableCell>
                      <TableCell className="font-mono text-xs">{r.action}</TableCell>
                      <TableCell className="text-sm">{r.entityType}{r.entityId && <span className="block font-mono text-[10px] text-muted-foreground">{link ? <Link href={link} className="underline">{r.entityId}</Link> : r.entityId}</span>}</TableCell>
                      <TableCell>
                        {(r.oldValue !== null || r.newValue !== null) && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground">View</summary>
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              {r.oldValue !== null && <pre className="max-h-60 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[11px]">{JSON.stringify(r.oldValue, null, 2)}</pre>}
                              {r.newValue !== null && <pre className="max-h-60 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[11px]">{JSON.stringify(r.newValue, null, 2)}</pre>}
                            </div>
                          </details>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
      <PaginationNav page={f.page} totalPages={Math.max(1, Math.ceil(total / f.pageSize))} basePath="/admin/audit-logs" params={{ action: f.action, entityType: f.entityType, entityId: f.entityId, pageSize: String(f.pageSize) }} className="mt-6" />
    </>
  );
}
