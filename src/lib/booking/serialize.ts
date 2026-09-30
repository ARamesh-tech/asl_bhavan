import type { BookingWithRelations } from "./booking-service";
import { formatDateOnly } from "./dates";

/**
 * Customer-facing booking DTO. Strips internal notes, admin ids, guest ID documents and
 * Decimal objects so it can be returned from APIs and passed to client components safely.
 */
export type BookingDto = {
  id: string;
  bookingReference: string;
  status: BookingWithRelations["status"];
  paymentStatus: BookingWithRelations["paymentStatus"];
  source: BookingWithRelations["source"];
  room: { id: string; name: string; slug: string; type: "PRIVATE_ROOM" | "DORMITORY"; category: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  currency: string;
  roomCharges: number;
  additionalCharges: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  holdExpiresAt: string | null;
  specialRequests: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  actualCheckInAt: string | null;
  actualCheckOutAt: string | null;
  createdAt: string;
  receipt: { id: string; receiptNumber: string; pdfUrl: string | null } | null;
  guests: Array<{ fullName: string; isPrimary: boolean; age: number | null }>;
  payments: Array<{ id: string; amount: number; method: string; status: string; transactionId: string | null; paidAt: string | null }>;
};

export function toBookingDto(b: BookingWithRelations): BookingDto {
  return {
    id: b.id,
    bookingReference: b.bookingReference,
    status: b.status,
    paymentStatus: b.paymentStatus,
    source: b.source,
    room: { id: b.room.id, name: b.room.name, slug: b.room.slug, type: b.room.type, category: b.room.category },
    checkIn: formatDateOnly(b.checkIn),
    checkOut: formatDateOnly(b.checkOut),
    nights: b.nights,
    guestCount: b.guestCount,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    guestPhone: b.guestPhone,
    currency: b.currency,
    roomCharges: b.roomCharges.toNumber(),
    additionalCharges: b.additionalCharges.toNumber(),
    discount: b.discount.toNumber(),
    taxRate: b.taxRate.toNumber(),
    taxAmount: b.taxAmount.toNumber(),
    totalAmount: b.totalAmount.toNumber(),
    amountPaid: b.amountPaid.toNumber(),
    holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
    specialRequests: b.specialRequests,
    confirmedAt: b.confirmedAt?.toISOString() ?? null,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    cancellationReason: b.cancellationReason,
    actualCheckInAt: b.actualCheckInAt?.toISOString() ?? null,
    actualCheckOutAt: b.actualCheckOutAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    receipt: b.receipt ? { id: b.receipt.id, receiptNumber: b.receipt.receiptNumber, pdfUrl: b.receipt.pdfUrl } : null,
    guests: b.guests.map((g) => ({ fullName: g.fullName, isPrimary: g.isPrimary, age: g.age })),
    payments: b.payments.map((p) => ({ id: p.id, amount: p.amount.toNumber(), method: p.method, status: p.status, transactionId: p.transactionId, paidAt: p.paidAt?.toISOString() ?? null })),
  };
}
