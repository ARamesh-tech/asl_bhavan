import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { PriceSummary } from "@/components/booking/price-summary";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/booking/status-badge";
import type { BookingDto } from "@/lib/booking/serialize";
import { formatDateDisplay, parseDateOnly } from "@/lib/booking/dates";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { PaymentMethod } from "@/generated/prisma/client";

function display(d: string) {
  const parsed = parseDateOnly(d);
  return parsed ? formatDateDisplay(parsed) : d;
}

export function BookingDetails({
  booking,
  property,
  showGuestContact = true,
  receiptQuery,
}: {
  booking: BookingDto;
  property: { checkInTime: string; checkOutTime: string; addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; googleMapsUrl: string };
  showGuestContact?: boolean;
  /** Query string (e.g. `?e=guest@example.com`) appended to the receipt link for guests without an account. */
  receiptQuery?: string | null;
}) {
  const address = [property.addressLine1, property.addressLine2, property.city, property.state, property.postalCode].filter(Boolean).join(", ");
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">{booking.room.category}</p>
              <h2 className="text-xl font-semibold"><Link href={`/rooms/${booking.room.slug}`} className="hover:underline">{booking.room.name}</Link></h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <BookingStatusBadge status={booking.status} />
              <PaymentStatusBadge status={booking.paymentStatus} />
            </div>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden /> Check-in</dt>
              <dd className="mt-1 font-medium">{display(booking.checkIn)}</dd>
              <dd className="text-xs text-muted-foreground">from {property.checkInTime}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden /> Check-out</dt>
              <dd className="mt-1 font-medium">{display(booking.checkOut)}</dd>
              <dd className="text-xs text-muted-foreground">by {property.checkOutTime}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" aria-hidden /> Guests</dt>
              <dd className="mt-1 font-medium">{booking.guestCount} · {booking.nights} night{booking.nights === 1 ? "" : "s"}</dd>
            </div>
          </dl>
          {booking.guests.length > 0 && (
            <div className="mt-5">
              <p className="text-xs text-muted-foreground">Guest names</p>
              <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                {booking.guests.map((g, i) => (
                  <li key={i} className="rounded-full bg-muted px-2.5 py-0.5">{g.fullName}{g.isPrimary ? " (primary)" : ""}{g.age != null ? `, ${g.age}` : ""}</li>
                ))}
              </ul>
            </div>
          )}
          {booking.specialRequests && (
            <div className="mt-5 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Special requests: </span>{booking.specialRequests}</div>
          )}
        </div>

        {showGuestContact && (
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h3 className="font-semibold">Contact details</h3>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Name</dt><dd>{booking.guestName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{booking.guestPhone}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all">{booking.guestEmail}</dd></div>
            </dl>
          </div>
        )}

        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand" aria-hidden /> Getting there</h3>
          <p className="mt-2 text-sm text-muted-foreground">{address}</p>
          {property.googleMapsUrl && (
            <a href={property.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-brand underline">Open in Google Maps</a>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="font-semibold">Payment summary</h3>
          <PriceSummary
            className="mt-3"
            currency={booking.currency}
            nights={booking.nights}
            guestCount={booking.guestCount}
            units={booking.room.type === "DORMITORY" ? booking.guestCount : 1}
            isDormitory={booking.room.type === "DORMITORY"}
            roomCharges={booking.roomCharges}
            additionalCharges={booking.additionalCharges}
            discount={booking.discount}
            taxRate={booking.taxRate}
            taxAmount={booking.taxAmount}
            totalAmount={booking.totalAmount}
            amountPaid={booking.amountPaid}
          />
          {booking.payments.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
              {booking.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>{PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}{p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString("en-IN")}` : ""}</span>
                  <span className="font-medium text-foreground">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
          {booking.receipt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Receipt{" "}
              <Link href={`/receipts/${encodeURIComponent(booking.receipt.receiptNumber)}${receiptQuery ?? ""}`} className="font-medium text-brand underline">
                {booking.receipt.receiptNumber}
              </Link>
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
