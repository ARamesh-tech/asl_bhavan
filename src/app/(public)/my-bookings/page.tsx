import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Users } from "lucide-react";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/booking/status-badge";
import { EmptyNote, PageHero } from "@/components/layout/section";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { Button } from "@/components/ui/button";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { listCustomerBookings, type CustomerBookingScope } from "@/lib/booking/customer-service";
import { formatDateDisplay } from "@/lib/booking/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

const SCOPES: Array<{ id: CustomerBookingScope; label: string }> = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];
const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUserOrRedirect("/my-bookings");
  const sp = await searchParams;
  const scope = (SCOPES.find((s) => s.id === sp.scope)?.id ?? "upcoming") as CustomerBookingScope;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listCustomerBookings(user, scope, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHero eyebrow={`Welcome, ${user.name.split(" ")[0]}`} title="My bookings" description="All your stays at a glance. Bookings made with this email before you registered appear here too.">
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/availability">Book another stay</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/profile">Profile &amp; password</Link></Button>
        </div>
      </PageHero>

      <div className="container-page py-10">
        <nav aria-label="Filter bookings" className="mb-6 flex flex-wrap gap-2">
          {SCOPES.map((s) => (
            <Link
              key={s.id}
              href={s.id === "upcoming" ? "/my-bookings" : `/my-bookings?scope=${s.id}`}
              aria-current={scope === s.id ? "page" : undefined}
              className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", scope === s.id ? "border-brand bg-brand text-white" : "hover:bg-muted")}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <EmptyNote>
            {scope === "upcoming" ? "You have no upcoming stays. " : "Nothing here yet. "}
            <Link href="/availability" className="underline">Check availability</Link> to plan your next visit.
          </EmptyNote>
        ) : (
          <ul className="space-y-4">
            {rows.map((b) => (
              <li key={b.id}>
                <Link href={`/booking/${b.bookingReference}`} className="group flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft transition-shadow hover:shadow-lift sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{b.bookingReference}</span>
                      <BookingStatusBadge status={b.status} />
                      <PaymentStatusBadge status={b.paymentStatus} />
                    </div>
                    <p className="mt-2 text-lg font-semibold">{b.room.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{formatDateDisplay(b.checkIn)} → {formatDateDisplay(b.checkOut)} · {b.nights} night{b.nights === 1 ? "" : "s"}</span>
                      <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden />{b.guestCount} guest{b.guestCount === 1 ? "" : "s"}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <p className="text-lg font-semibold text-brand-deep">{formatMoney(b.totalAmount.toNumber(), b.currency)}</p>
                    <span className="inline-flex items-center text-sm text-muted-foreground group-hover:text-foreground">Details <ChevronRight className="size-4" aria-hidden /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <PaginationNav page={page} totalPages={totalPages} basePath="/my-bookings" params={{ scope: scope === "upcoming" ? undefined : scope }} className="mt-8" />
      </div>
    </>
  );
}
