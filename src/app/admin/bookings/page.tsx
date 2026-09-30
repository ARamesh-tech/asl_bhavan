import type { Metadata } from "next";
import Link from "next/link";
import { BookingFilters } from "@/components/admin/booking-filters";
import { BookingTable } from "@/components/admin/booking-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationNav } from "@/components/layout/pagination-nav";
import { Button } from "@/components/ui/button";
import { adminBookingFilterSchema, BOOKING_SOURCES, BOOKING_STATUSES, listAdminBookings, PAYMENT_STATUSES } from "@/lib/admin/bookings-service";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Bookings" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValues(sp: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = firstValues(await searchParams);
  const parsed = adminBookingFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : adminBookingFilterSchema.parse({});
  const [{ rows, total }, rooms] = await Promise.all([
    listAdminBookings(filters),
    prisma.room.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const exportQs = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (v && k !== "page" && k !== "pageSize") exportQs.set(k, v);

  return (
    <>
      <AdminPageHeader
        title="Bookings"
        description={`${total} booking${total === 1 ? "" : "s"} match`}
        actions={<Button asChild><Link href="/admin/bookings/new">New manual booking</Link></Button>}
      />
      <BookingFilters
        values={raw}
        rooms={rooms}
        statuses={BOOKING_STATUSES}
        paymentStatuses={PAYMENT_STATUSES}
        sources={BOOKING_SOURCES}
        exportHref={`/api/admin/bookings/export?${exportQs.toString()}`}
      />
      {!parsed.success && <p className="mt-3 text-sm text-destructive">Some filters were invalid and have been ignored.</p>}
      <div className="mt-4 rounded-2xl border bg-card shadow-soft">
        <BookingTable rows={rows} />
      </div>
      <PaginationNav page={filters.page} totalPages={totalPages} basePath="/admin/bookings" params={Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "page"))} className="mt-6" />
    </>
  );
}
