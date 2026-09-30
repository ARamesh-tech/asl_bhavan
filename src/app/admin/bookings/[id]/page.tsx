import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Mail, MessageCircle, Pencil } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { BookingActions } from "@/components/admin/booking-actions";
import { InternalNotes } from "@/components/admin/internal-notes";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { BookingDetails } from "@/components/booking/booking-details";
import { Button } from "@/components/ui/button";
import { getBookingById } from "@/lib/booking/booking-service";
import { toBookingDto } from "@/lib/booking/serialize";
import { prisma } from "@/lib/db/prisma";
import { BOOKING_SOURCE_LABELS } from "@/lib/labels";
import { getSettingsGroup } from "@/lib/settings/service";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Booking" };

function fmt(d: Date | null | undefined) {
  return d ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "—";
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) notFound();
  const [property, people, audit] = await Promise.all([
    getSettingsGroup("property"),
    prisma.user.findMany({
      where: { id: { in: [booking.userId, booking.createdById, booking.confirmedById, booking.cancelledById].filter((v): v is string => !!v) } },
      select: { id: true, name: true, email: true },
    }),
    prisma.auditLog.findMany({ where: { entityType: "Booking", entityId: booking.id }, orderBy: { createdAt: "desc" }, take: 20, include: { adminUser: { select: { name: true } } } }),
  ]);
  const who = (uid: string | null) => people.find((p) => p.id === uid);
  const dto = toBookingDto(booking);
  const guestWhatsapp = whatsappLink(booking.guestPhone, `Hello ${booking.guestName}, this is ${property.name} regarding your booking ${booking.bookingReference}.`);
  const pricing = booking.pricingSnapshot as { perNight?: Array<{ date: string; amount: number; source: string }> } | null;

  return (
    <>
      <Link href="/admin/bookings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> All bookings</Link>
      <AdminPageHeader
        title={booking.bookingReference}
        description={`${BOOKING_SOURCE_LABELS[booking.source]} · created ${fmt(booking.createdAt)}${booking.deletedAt ? " · DELETED" : ""}`}
        actions={
          <>
            {guestWhatsapp !== "#" && (
              <Button asChild variant="outline"><a href={guestWhatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden /> WhatsApp guest</a></Button>
            )}
            <Button asChild variant="outline"><Link href={`/admin/bookings/${booking.id}/edit`}><Pencil aria-hidden /> Modify</Link></Button>
          </>
        }
      />

      {!booking.deletedAt && (
        <div className="mb-6 rounded-2xl border bg-card p-4 shadow-soft">
          <BookingActions bookingId={booking.id} status={booking.status} totalAmount={dto.totalAmount} amountPaid={dto.amountPaid} currency={booking.currency} guestEmail={booking.guestEmail} />
        </div>
      )}

      <BookingDetails booking={dto} property={property} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Panel title="Internal notes" description="Visible to admins only.">
            <InternalNotes bookingId={booking.id} initial={booking.internalNotes} />
          </Panel>
          <Panel title="Receipt" description="Issued once per booking; the number never changes.">
            {booking.receipt ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <a href={`/api/receipts/${booking.receipt.receiptNumber}/pdf`} target="_blank" rel="noopener noreferrer" className="font-mono text-brand hover:underline">{booking.receipt.receiptNumber}</a>
                  <p className="text-xs text-muted-foreground">Issued {fmt(booking.receipt.issuedAt)}</p>
                </div>
                <div className="flex gap-1">
                  <ActionButton url={`/api/admin/receipts/${booking.receipt.id}`} json={{ action: "EMAIL" }} successMessage="Receipt emailed to guest"><Mail aria-hidden /> Email guest</ActionButton>
                  <Button asChild variant="ghost" size="sm"><Link href="/admin/receipts">All receipts</Link></Button>
                </div>
              </div>
            ) : ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(booking.status) && !booking.deletedAt ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-muted-foreground">No receipt issued yet.</p>
                <ActionButton url="/api/admin/receipts" json={{ bookingId: booking.id }} successMessage="Receipt issued"><FileText aria-hidden /> Issue receipt</ActionButton>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Receipts are available once the booking is confirmed.</p>
            )}
          </Panel>
        </div>
        <Panel title="Timeline">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Created</dt><dd>{fmt(booking.createdAt)}{who(booking.createdById) ? ` · ${who(booking.createdById)!.name}` : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Customer account</dt><dd>{who(booking.userId) ? <Link href={`/admin/users/${booking.userId}`} className="text-brand underline">{who(booking.userId)!.email}</Link> : "Guest (no account)"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Hold expires</dt><dd>{booking.status === "PENDING_PAYMENT" ? fmt(booking.holdExpiresAt) : "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Confirmed</dt><dd>{fmt(booking.confirmedAt)}{who(booking.confirmedById) ? ` · ${who(booking.confirmedById)!.name}` : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Checked in</dt><dd>{fmt(booking.actualCheckInAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Checked out</dt><dd>{fmt(booking.actualCheckOutAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Cancelled</dt><dd>{fmt(booking.cancelledAt)}{who(booking.cancelledById) ? ` · ${who(booking.cancelledById)!.name}` : ""}</dd></div>
          </dl>
          {pricing?.perNight && pricing.perNight.length > 0 && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Price snapshot at booking time</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {pricing.perNight.map((n) => <li key={n.date} className="flex justify-between gap-2"><span>{n.date} <span className="text-muted-foreground">({n.source.toLowerCase()})</span></span><span>{n.amount.toFixed(2)}</span></li>)}
              </ul>
            </details>
          )}
        </Panel>
      </div>

      <Panel title="Activity log" description="Latest 20 audit entries for this booking." className="mt-6">
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span><span className="font-mono text-xs">{a.action}</span>{a.adminUser ? <span className="text-muted-foreground"> · {a.adminUser.name}</span> : <span className="text-muted-foreground"> · system</span>}</span>
                <span className="text-xs text-muted-foreground">{fmt(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs"><Link href={`/admin/audit-logs?entityType=Booking&entityId=${booking.id}`} className="underline">Full history</Link></p>
      </Panel>
    </>
  );
}
