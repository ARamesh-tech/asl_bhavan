import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PriceSummary } from "@/components/booking/price-summary";
import { RazorpayCheckout } from "@/components/booking/razorpay-checkout";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { assertBookingAccess } from "@/lib/booking/access";
import { getBookingByReference } from "@/lib/booking/booking-service";
import { formatDateDisplay } from "@/lib/booking/dates";
import { toBookingDto } from "@/lib/booking/serialize";
import { integrations } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings/service";
import { bookingReferenceSchema } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Complete payment", robots: { index: false } };

export default async function PayPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ reference }, sp] = await Promise.all([params, searchParams]);
  const parsedRef = bookingReferenceSchema.safeParse(reference);
  if (!parsedRef.success) notFound();
  const emailHint = typeof sp.e === "string" ? sp.e : null;

  const [booking, user, settings] = await Promise.all([getBookingByReference(parsedRef.data), getCurrentUser(), getSettings()]);
  if (!booking) notFound();
  try {
    assertBookingAccess(booking, user, emailHint);
  } catch (err) {
    if (isAppError(err)) notFound();
    throw err;
  }

  const back = `/booking/${encodeURIComponent(booking.bookingReference)}${emailHint ? `?e=${encodeURIComponent(emailHint)}` : ""}`;
  if (booking.status !== "PENDING_PAYMENT") redirect(back);

  const dto = toBookingDto(booking);
  const balance = booking.totalAmount.toNumber() - booking.amountPaid.toNumber();
  const online = integrations().razorpay;

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Booking {booking.bookingReference}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Complete your payment</h1>
          <p className="mt-2 text-muted-foreground">
            {booking.room.name} · {formatDateDisplay(booking.checkIn)} → {formatDateDisplay(booking.checkOut)} · {booking.nights} night{booking.nights === 1 ? "" : "s"} · {booking.guestCount} guest{booking.guestCount === 1 ? "" : "s"}
          </p>

          <div className="mt-8 rounded-2xl border bg-card p-6 shadow-soft">
            {online ? (
              <RazorpayCheckout
                reference={booking.bookingReference}
                emailHint={emailHint}
                propertyName={settings.property.name}
                amountLabel={formatMoney(balance, booking.currency)}
                holdExpiresAt={booking.holdExpiresAt?.toISOString() ?? null}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm">Online payment is temporarily unavailable. Please contact the owner to arrange payment directly.</p>
                <Button asChild variant="outline"><Link href="/contact">Contact us</Link></Button>
              </div>
            )}
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Changed your mind? <Link href={back} className="underline">Back to booking</Link>. Unpaid bookings are released automatically when the hold expires.
          </p>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="text-base font-semibold">Price summary</h2>
            <div className="mt-4">
              <PriceSummary
                currency={dto.currency}
                nights={dto.nights}
                guestCount={dto.guestCount}
                units={dto.room.type === "DORMITORY" ? dto.guestCount : 1}
                isDormitory={dto.room.type === "DORMITORY"}
                roomCharges={dto.roomCharges}
                additionalCharges={dto.additionalCharges}
                discount={dto.discount}
                taxRate={dto.taxRate}
                taxAmount={dto.taxAmount}
                totalAmount={dto.totalAmount}
                amountPaid={dto.amountPaid}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
