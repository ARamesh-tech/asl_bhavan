import "server-only";
import { z } from "zod";
import type { BookingSource, BookingStatus, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { bookingInclude, type BookingWithRelations } from "@/lib/booking/booking-service";
import { formatDateOnly, parseDateOnly } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/booking/status";
import { BOOKING_SOURCE_LABELS } from "@/lib/labels";
import { paginationSchema } from "@/lib/validation/common";

export const BOOKING_STATUSES: BookingStatus[] = ["PENDING_PAYMENT", "OWNER_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "EXPIRED", "NO_SHOW", "DRAFT"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PAID", "PARTIAL", "FAILED", "REFUNDED", "CASH", "DIRECT_UPI", "BANK_TRANSFER", "PAY_ON_ARRIVAL"];
export const BOOKING_SOURCES: BookingSource[] = ["ONLINE", "WHATSAPP", "MANUAL", "PHONE", "WALK_IN"];

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? parseDateOnly(v) ?? undefined : undefined));

export const adminBookingFilterSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(BOOKING_STATUSES as [BookingStatus, ...BookingStatus[]]).optional().or(z.literal("").transform(() => undefined)),
  paymentStatus: z.enum(PAYMENT_STATUSES as [PaymentStatus, ...PaymentStatus[]]).optional().or(z.literal("").transform(() => undefined)),
  source: z.enum(BOOKING_SOURCES as [BookingSource, ...BookingSource[]]).optional().or(z.literal("").transform(() => undefined)),
  roomId: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  from: optionalDate,
  to: optionalDate,
  /** Which date the from/to range applies to. */
  dateField: z.enum(["checkIn", "checkOut", "createdAt"]).default("checkIn"),
  sort: z.enum(["checkIn", "createdAt", "totalAmount"]).default("checkIn"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.coerce.boolean().default(false),
});

export type AdminBookingFilters = z.infer<typeof adminBookingFilterSchema>;

export function adminBookingsWhere(f: AdminBookingFilters): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  if (!f.includeDeleted) where.deletedAt = null;
  if (f.status) where.status = f.status;
  if (f.paymentStatus) where.paymentStatus = f.paymentStatus;
  if (f.source) where.source = f.source;
  if (f.roomId) where.roomId = f.roomId;
  if (f.from || f.to) {
    const range: Prisma.DateTimeFilter = {};
    if (f.from) range.gte = f.from;
    if (f.to) range.lte = f.dateField === "createdAt" ? new Date(f.to.getTime() + 86_400_000 - 1) : f.to;
    where[f.dateField] = range;
  }
  if (f.q) {
    const q = f.q;
    where.OR = [
      { bookingReference: { contains: q, mode: "insensitive" } },
      { guestName: { contains: q, mode: "insensitive" } },
      { guestEmail: { contains: q, mode: "insensitive" } },
      { guestPhone: { contains: q.replace(/[\s\-().]/g, "") } },
      { room: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function listAdminBookings(f: AdminBookingFilters): Promise<{ rows: BookingWithRelations[]; total: number }> {
  const where = adminBookingsWhere(f);
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ [f.sort]: f.dir }, { createdAt: "desc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: bookingInclude,
    }),
    prisma.booking.count({ where }),
  ]);
  return { rows, total };
}

/** Streams every matching booking (capped) as CSV text for the export button. */
export async function exportAdminBookingsCsv(f: AdminBookingFilters, cap = 5000): Promise<string> {
  const rows = await prisma.booking.findMany({
    where: adminBookingsWhere(f),
    orderBy: [{ [f.sort]: f.dir }],
    take: cap,
    include: bookingInclude,
  });
  const header = [
    "Booking reference", "Status", "Payment status", "Source", "Room", "Guest name", "Guest email", "Guest phone",
    "Check-in", "Check-out", "Nights", "Guests", "Room charges", "Additional", "Discount", "Tax", "Total", "Paid", "Balance",
    "Receipt", "Created at", "Confirmed at", "Cancelled at",
  ];
  const lines = rows.map((b) => {
    const total = b.totalAmount.toNumber();
    const paid = b.amountPaid.toNumber();
    return [
      b.bookingReference, BOOKING_STATUS_LABELS[b.status], PAYMENT_STATUS_LABELS[b.paymentStatus], BOOKING_SOURCE_LABELS[b.source], b.room.name,
      b.guestName, b.guestEmail, b.guestPhone, formatDateOnly(b.checkIn), formatDateOnly(b.checkOut), b.nights, b.guestCount,
      b.roomCharges.toNumber(), b.additionalCharges.toNumber(), b.discount.toNumber(), b.taxAmount.toNumber(), total, paid, Math.max(0, total - paid),
      b.receipt?.receiptNumber ?? "", b.createdAt.toISOString(), b.confirmedAt?.toISOString() ?? "", b.cancelledAt?.toISOString() ?? "",
    ];
  });
  return toCsv([header, ...lines]);
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Guard against spreadsheet formula injection as well as delimiter/quote escaping.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return `\uFEFF${rows.map((r) => r.map(esc).join(",")).join("\r\n")}\r\n`;
}
