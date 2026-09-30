import Link from "next/link";
import { Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/booking/status";
import { BOOKING_SOURCE_LABELS } from "@/lib/labels";
import type { BookingSource, BookingStatus, PaymentStatus } from "@/generated/prisma/client";

/** Server-rendered filter bar — plain GET form so filters live in the URL and are shareable. */
export function BookingFilters({
  values,
  rooms,
  statuses,
  paymentStatuses,
  sources,
  exportHref,
}: {
  values: Record<string, string | undefined>;
  rooms: Array<{ id: string; name: string }>;
  statuses: BookingStatus[];
  paymentStatuses: PaymentStatus[];
  sources: BookingSource[];
  exportHref: string;
}) {
  const select = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
  const hasFilters = Object.entries(values).some(([k, v]) => v && k !== "page");
  return (
    <form method="get" className="grid gap-3 rounded-2xl border bg-card p-4 shadow-soft md:grid-cols-12">
      <div className="relative md:col-span-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input name="q" defaultValue={values.q ?? ""} placeholder="Reference, name, phone, email…" aria-label="Search bookings" className="h-10 pl-9" />
      </div>
      <label className="md:col-span-2">
        <span className="sr-only">Status</span>
        <select name="status" defaultValue={values.status ?? ""} className={select}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="sr-only">Payment status</span>
        <select name="paymentStatus" defaultValue={values.paymentStatus ?? ""} className={select}>
          <option value="">Any payment</option>
          {paymentStatuses.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="sr-only">Room</span>
        <select name="roomId" defaultValue={values.roomId ?? ""} className={select}>
          <option value="">Any room</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="sr-only">Source</span>
        <select name="source" defaultValue={values.source ?? ""} className={select}>
          <option value="">Any source</option>
          {sources.map((s) => <option key={s} value={s}>{BOOKING_SOURCE_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="sr-only">Date field</span>
        <select name="dateField" defaultValue={values.dateField ?? "checkIn"} className={select}>
          <option value="checkIn">Check-in between</option>
          <option value="checkOut">Check-out between</option>
          <option value="createdAt">Created between</option>
        </select>
      </label>
      <Input type="date" name="from" defaultValue={values.from ?? ""} aria-label="From date" className="h-10 md:col-span-2" />
      <Input type="date" name="to" defaultValue={values.to ?? ""} aria-label="To date" className="h-10 md:col-span-2" />
      <label className="md:col-span-2">
        <span className="sr-only">Sort</span>
        <select name="sort" defaultValue={values.sort ?? "checkIn"} className={select}>
          <option value="checkIn">Sort: check-in</option>
          <option value="createdAt">Sort: created</option>
          <option value="totalAmount">Sort: amount</option>
        </select>
      </label>
      <label className="md:col-span-1">
        <span className="sr-only">Direction</span>
        <select name="dir" defaultValue={values.dir ?? "desc"} className={select}>
          <option value="desc">↓</option>
          <option value="asc">↑</option>
        </select>
      </label>
      <label className="md:col-span-1">
        <span className="sr-only">Page size</span>
        <select name="pageSize" defaultValue={values.pageSize ?? "20"} className={select}>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-4 md:justify-end">
        <Button type="submit" className="h-10">Apply</Button>
        {hasFilters && <Button asChild variant="ghost" className="h-10"><Link href="/admin/bookings"><X aria-hidden /> Clear</Link></Button>}
        <Button asChild variant="outline" className="h-10"><a href={exportHref}><Download aria-hidden /> CSV</a></Button>
      </div>
    </form>
  );
}
