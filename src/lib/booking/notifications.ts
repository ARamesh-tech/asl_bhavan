import "server-only";
import { prisma } from "@/lib/db/prisma";
import { publicEnv } from "@/lib/env";
import { emailBranding } from "@/lib/email/branding";
import { sendEmail } from "@/lib/email/service";
import {
  bookingCancelledTemplate,
  bookingConfirmedTemplate,
  bookingRequestTemplate,
  ownerNewBookingTemplate,
  type BookingEmailData,
} from "@/lib/email/templates";
import { formatMoney } from "@/lib/money";
import { getSettingsGroup } from "@/lib/settings/service";
import { bookingRequestMessage, whatsappLink } from "@/lib/whatsapp";
import { bookingInclude, type BookingWithRelations } from "./booking-service";
import { formatDateDisplay } from "./dates";
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "./status";

/**
 * Booking notification helpers. All functions are best-effort: they log failures through
 * EmailLog and never throw into the booking transaction.
 */

export async function resolveWhatsappNumber(): Promise<string> {
  const property = await getSettingsGroup("property");
  return property.whatsappNumber || publicEnv.whatsappNumber;
}

export async function bookingWhatsappUrl(b: BookingWithRelations): Promise<string | null> {
  const [number, property] = await Promise.all([resolveWhatsappNumber(), getSettingsGroup("property")]);
  if (!number) return null;
  return whatsappLink(
    number,
    bookingRequestMessage({
      propertyName: property.name,
      bookingReference: b.bookingReference,
      roomName: b.room.name,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      guestCount: b.guestCount,
      guestName: b.guestName,
      guestPhone: b.guestPhone,
    }),
  );
}

async function emailData(b: BookingWithRelations): Promise<BookingEmailData> {
  const property = await getSettingsGroup("property");
  const currency = b.currency;
  const total = b.totalAmount.toNumber();
  const paid = b.amountPaid.toNumber();
  const address = [property.addressLine1, property.addressLine2, property.city, property.state, property.postalCode]
    .filter(Boolean)
    .join(", ");
  return {
    bookingReference: b.bookingReference,
    guestName: b.guestName,
    roomName: b.room.name,
    checkIn: formatDateDisplay(b.checkIn),
    checkOut: formatDateDisplay(b.checkOut),
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    nights: b.nights,
    guestCount: b.guestCount,
    totalAmount: formatMoney(total, currency),
    amountPaid: formatMoney(paid, currency),
    balanceDue: formatMoney(Math.max(0, total - paid), currency),
    paymentStatusLabel: PAYMENT_STATUS_LABELS[b.paymentStatus],
    statusLabel: BOOKING_STATUS_LABELS[b.status],
    address,
    mapsUrl: property.googleMapsUrl || publicEnv.googleMapsUrl || undefined,
    whatsappUrl: (await bookingWhatsappUrl(b)) ?? undefined,
    manageUrl: `${publicEnv.siteUrl}/booking/${encodeURIComponent(b.bookingReference)}`,
  };
}

async function load(bookingId: string): Promise<BookingWithRelations | null> {
  return prisma.booking.findFirst({ where: { id: bookingId }, include: bookingInclude });
}

export async function sendBookingRequestEmail(bookingId: string) {
  const b = await load(bookingId);
  if (!b) return;
  const tpl = bookingRequestTemplate(await emailBranding(), await emailData(b));
  await sendEmail({ to: b.guestEmail, template: "booking-request", bookingId: b.id, ...tpl });
}

export async function sendBookingConfirmedEmail(bookingId: string) {
  const b = await load(bookingId);
  if (!b) return;
  const tpl = bookingConfirmedTemplate(await emailBranding(), await emailData(b));
  await sendEmail({ to: b.guestEmail, template: "booking-confirmed", bookingId: b.id, ...tpl });
}

export async function sendBookingCancelledEmail(bookingId: string) {
  const b = await load(bookingId);
  if (!b) return;
  const tpl = bookingCancelledTemplate(await emailBranding(), { ...(await emailData(b)), reason: b.cancellationReason });
  await sendEmail({ to: b.guestEmail, template: "booking-cancelled", bookingId: b.id, ...tpl });
}

/** Notify the owner (settings.notifications.ownerEmail or OWNER_NOTIFICATION_EMAIL) and email the guest. */
export async function notifyOwnerOfNewBooking(bookingId: string) {
  const b = await load(bookingId);
  if (!b) return;
  const notifications = await getSettingsGroup("notifications");

  if (b.status === "OWNER_CONFIRMATION" && notifications.sendCustomerConfirmationEmail) {
    await sendBookingRequestEmail(b.id);
  }

  const ownerEmail = notifications.ownerNotificationEmail || process.env.OWNER_NOTIFICATION_EMAIL || "";
  if (!ownerEmail || !notifications.notifyOwnerOnNewBooking) return;
  const tpl = ownerNewBookingTemplate(await emailBranding(), {
    ...(await emailData(b)),
    guestPhone: b.guestPhone,
    guestEmail: b.guestEmail,
    specialRequests: b.specialRequests,
    adminUrl: `${publicEnv.siteUrl}/admin/bookings/${b.id}`,
  });
  await sendEmail({ to: ownerEmail, template: "owner-new-booking", bookingId: b.id, ...tpl });
}
