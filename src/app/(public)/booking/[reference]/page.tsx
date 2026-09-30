import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, MessageCircle, XCircle } from "lucide-react";
import { BookingDetails } from "@/components/booking/booking-details";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { assertBookingAccess } from "@/lib/booking/access";
import { getBookingByReference } from "@/lib/booking/booking-service";
import { bookingWhatsappUrl } from "@/lib/booking/notifications";
import { toBookingDto } from "@/lib/booking/serialize";
import { canTransition } from "@/lib/booking/status";
import { isAppError } from "@/lib/errors";
import { getSettings } from "@/lib/settings/service";
import { bookingReferenceSchema } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

type Params = Promise<{ reference: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
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

  const dto = toBookingDto(booking);
  const whatsappUrl = booking.status === "OWNER_CONFIRMATION" ? await bookingWhatsappUrl(booking) : null;
  const isNew = sp.new === "1";
  const canCancel = settings.booking.allowCustomerCancellation && canTransition(booking.status, "CANCELLED") && booking.status !== "CHECKED_IN";
  const cutoffOk = new Date() <= new Date(booking.checkIn.getTime() - settings.booking.cancellationCutoffHours * 3_600_000);

  const header = (() => {
    switch (booking.status) {
      case "OWNER_CONFIRMATION":
        return { icon: Clock, tone: "text-status-partial", title: isNew ? "Booking request received" : "Awaiting owner confirmation", body: "Your room is reserved provisionally. Contact the owner on WhatsApp to arrange payment — once received, you will get a confirmation email and receipt." };
      case "PENDING_PAYMENT":
        return { icon: Clock, tone: "text-status-partial", title: "Payment pending", body: "Complete your payment to confirm this booking. The room is held for a short time." };
      case "CONFIRMED":
        return { icon: CheckCircle2, tone: "text-status-available", title: "Booking confirmed", body: "We look forward to welcoming you. Please carry a valid government photo ID for all guests." };
      case "CHECKED_IN":
        return { icon: CheckCircle2, tone: "text-status-checked-in", title: "You're checked in", body: "Enjoy your stay. Contact the owner if you need anything." };
      case "CHECKED_OUT":
        return { icon: CheckCircle2, tone: "text-muted-foreground", title: "Stay completed", body: "Thank you for staying with us. We hope to see you again." };
      case "CANCELLED":
        return { icon: XCircle, tone: "text-status-booked", title: "Booking cancelled", body: booking.cancellationReason ? `Reason: ${booking.cancellationReason}` : "This booking has been cancelled." };
      case "EXPIRED":
        return { icon: XCircle, tone: "text-muted-foreground", title: "Booking expired", body: "The payment window closed before payment was received. You can search again or contact the owner." };
      case "NO_SHOW":
        return { icon: XCircle, tone: "text-status-booked", title: "Marked as no-show", body: "Please contact the owner if this is incorrect." };
      default:
        return { icon: Clock, tone: "text-muted-foreground", title: "Booking", body: "" };
    }
  })();
  const Icon = header.icon;

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Booking reference</p>
          <h1 className="font-mono text-3xl font-semibold tracking-tight">{booking.bookingReference}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {whatsappUrl && (
            <Button asChild size="lg" className="bg-[oklch(0.62_0.17_150)] text-white hover:bg-[oklch(0.56_0.17_150)]">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden /> Contact owner on WhatsApp</a>
            </Button>
          )}
          {booking.status === "PENDING_PAYMENT" && (
            <Button asChild size="lg"><Link href={`/booking/${booking.bookingReference}/pay${emailHint ? `?e=${encodeURIComponent(emailHint)}` : ""}`}>Complete payment</Link></Button>
          )}
          {canCancel && cutoffOk && (
            <CancelBookingButton reference={booking.bookingReference} emailHint={emailHint} policyText={settings.policies.cancellationPolicy} />
          )}
        </div>
      </div>

      <div className={`mb-8 flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-soft`}>
        <Icon className={`mt-0.5 size-6 shrink-0 ${header.tone}`} aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">{header.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{header.body}</p>
          {booking.status === "OWNER_CONFIRMATION" && !whatsappUrl && (
            <p className="mt-2 text-sm">The owner&apos;s WhatsApp number is not configured yet — please use the <Link href="/contact" className="underline">contact page</Link>.</p>
          )}
          {canCancel && !cutoffOk && (
            <p className="mt-2 text-xs text-muted-foreground">Online cancellation closes {settings.booking.cancellationCutoffHours} hours before check-in. Please contact the owner for changes.</p>
          )}
        </div>
      </div>

      <BookingDetails booking={dto} property={settings.property} receiptQuery={emailHint ? `?e=${encodeURIComponent(emailHint)}` : null} />

      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        {user ? (
          <Link href="/my-bookings" className="text-brand underline">All my bookings</Link>
        ) : (
          <span className="text-muted-foreground">
            Bookmark this page to return to your booking. <Link href={`/register?next=${encodeURIComponent(`/booking/${booking.bookingReference}`)}`} className="text-brand underline">Create an account</Link> with the same email to manage all your stays.
          </span>
        )}
      </div>
    </div>
  );
}
