import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { UserActions } from "@/components/admin/user-actions";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { getSettingsGroup } from "@/lib/settings/service";
import { cn } from "cn";

export const metadata: Metadata = { title: "Users & guests" };
const PAGE_SIZE = 20;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [me, sp, property] = await Promise.all([requireAdmin(), searchParams, getSettingsGroup("property")]);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tab = sp.tab === "guests" ? "guests" : "accounts";
  const page = Math.max(1, Number(sp.page) || 1);

  if (tab === "guests") {
    // Guest directory: distinct guests by email across all bookings (registered or not).
    const where = q ? { deletedAt: null, OR: [{ guestName: { contains: q, mode: "insensitive" as const } }, { guestEmail: { contains: q, mode: "insensitive" as const } }, { guestPhone: { contains: q.replace(/\D/g, "") } }] } : { deletedAt: null };
    const grouped = await prisma.booking.groupBy({
      by: ["guestEmail"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true, amountPaid: true },
      _max: { checkIn: true, guestName: true, guestPhone: true },
      orderBy: { _max: { checkIn: "desc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    const totalGroups = (await prisma.booking.findMany({ where, distinct: ["guestEmail"], select: { guestEmail: true } })).length;
    return (
      <>
        <Header tab={tab} q={q} />
        <Panel>
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Stays</TableHead><TableHead className="text-right">Total booked</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Last check-in</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {grouped.map((g) => (
                    <TableRow key={g.guestEmail}>
                      <TableCell className="font-medium">{g._max.guestName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground"><span className="block">{g.guestEmail}</span><span className="block">{g._max.guestPhone}</span></TableCell>
                      <TableCell className="text-right">{g._count._all}</TableCell>
                      <TableCell className="text-right">{formatMoney(g._sum.totalAmount?.toNumber() ?? 0, property.currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(g._sum.amountPaid?.toNumber() ?? 0, property.currency)}</TableCell>
                      <TableCell>{g._max.checkIn?.toLocaleDateString("en-IN", { timeZone: "UTC" })}</TableCell>
                      <TableCell className="text-right"><Button asChild size="sm" variant="ghost"><Link href={`/admin/bookings?q=${encodeURIComponent(g.guestEmail)}`}>Bookings</Link></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
        <PaginationNav page={page} totalPages={Math.max(1, Math.ceil(totalGroups / PAGE_SIZE))} basePath="/admin/users" params={{ tab, q: q || undefined }} className="mt-6" />
      </>
    );
  }

  const where = { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q.replace(/\D/g, "") } }] } : {}) };
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: [{ role: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, emailVerifiedAt: true, lastLoginAt: true, createdAt: true, _count: { select: { bookings: true } } } }),
    prisma.user.count({ where }),
  ]);

  return (
    <>
      <Header tab={tab} q={q} />
      <Panel>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Contact</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Bookings</TableHead><TableHead>Last login</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className={!u.isActive ? "opacity-60" : undefined}>
                  <TableCell>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">Joined {u.createdAt.toLocaleDateString("en-IN")}{!u.isActive && " · deactivated"}{!u.emailVerifiedAt && " · email unverified"}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground"><span className="block">{u.email}</span><span className="block">{u.phone}</span></TableCell>
                  <TableCell><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", u.role === "ADMIN" ? "bg-brand-soft text-brand-deep" : "bg-muted text-muted-foreground")}>{u.role}</span></TableCell>
                  <TableCell className="text-right"><Link href={`/admin/bookings?q=${encodeURIComponent(u.email)}`} className="underline">{u._count.bookings}</Link></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.lastLoginAt ? u.lastLoginAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Never"}</TableCell>
                  <TableCell className="text-right"><UserActions id={u.id} role={u.role} isActive={u.isActive} isSelf={u.id === me.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <PaginationNav page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} basePath="/admin/users" params={{ q: q || undefined }} className="mt-6" />
    </>
  );
}

function Header({ tab, q }: { tab: string; q: string }) {
  return (
    <>
      <AdminPageHeader title="Users & guests" description="Registered accounts, plus every guest who has ever booked (with or without an account)." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-2" aria-label="Tabs">
          <Link href="/admin/users" aria-current={tab === "accounts" ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", tab === "accounts" ? "border-brand bg-brand text-white" : "hover:bg-muted")}>Accounts</Link>
          <Link href="/admin/users?tab=guests" aria-current={tab === "guests" ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", tab === "guests" ? "border-brand bg-brand text-white" : "hover:bg-muted")}>Guest directory</Link>
        </nav>
        <form method="get" className="relative sm:w-80">
          <input type="hidden" name="tab" value={tab} />
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Search name, email, phone" aria-label="Search" className="h-10 pl-9" />
        </form>
      </div>
    </>
  );
}
