import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit";
import { bookingInclude, type BookingWithRelations } from "@/lib/booking/booking-service";
import { formatDateDisplay } from "@/lib/booking/dates";
import { nextReceiptNumber } from "@/lib/booking/sequence-service";
import { PAYMENT_STATUS_LABELS, SETTLED_PAYMENT_STATUSES } from "@/lib/booking/status";
import { prisma, type DbClient } from "@/lib/db/prisma";
import { emailBranding } from "@/lib/email/branding";
import { sendEmail } from "@/lib/email/service";
import { button, escapeHtml, layout } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { logger } from "@/lib/logger";
import { formatMoney } from "@/lib/money";
import { getSettingsGroup } from "@/lib/settings/service";
import { storage } from "@/lib/storage";
import { renderReceiptPdf } from "./pdf";
import type { ReceiptSnapshot } from "./snapshot";

/**
 * Receipts are issued once per booking (unique bookingId) with a sequential number
 * ASL-RCP-YYYYMMDD-0001. Issuing is idempotent: calling it again returns the existing
 * receipt. Regeneration re-renders the PDF from the *same* snapshot.
 */

async function buildSnapshot(b: BookingWithRelations, receiptNumber: string, issuedAt: Date, db: DbClient): Promise<ReceiptSnapshot> {
  const property = await getSettingsGroup("property", db);
  const total = b.totalAmount.toNumber();
  const paid = b.amountPaid.toNumber();
  const isDorm = b.room.type === "DORMITORY";
  const snap = b.pricingSnapshot as { perNight?: Array<{ date: string; unitPrice: number; amount: number; source: string; reason?: string }>; units?: number } | null;
  const perNight = snap?.perNight ?? [];

  // Collapse identical nightly rates into one line where possible for a tidy receipt.
  const lineItems: ReceiptSnapshot["lineItems"] = [];
  const grouped = new Map<string, { nights: number; unit: number; amount: number; label: string }>();
  for (const n of perNight) {
    const label = n.source === "OVERRIDE" ? n.reason ?? "Special rate" : n.source === "WEEKEND" ? "Weekend rate" : "Standard rate";
    const key = `${label}|${n.unitPrice}`;
    const g = grouped.get(key) ?? { nights: 0, unit: n.unitPrice, amount: 0, label };
    g.nights += 1;
    g.amount += n.amount;
    grouped.set(key, g);
  }
  for (const g of grouped.values()) {
    const units = snap?.units ?? (isDorm ? b.guestCount : 1);
    lineItems.push({
      description: `${b.room.name} — ${g.label}${isDorm ? ` × ${units} bed${units === 1 ? "" : "s"}` : ""}`,
      quantity: g.nights,
      unitAmount: isDorm ? g.unit * units : g.unit,
      amount: Math.round(g.amount * 100) / 100,
    });
  }
  if (lineItems.length === 0) {
    lineItems.push({ description: `${b.room.name} — ${b.nights} night${b.nights === 1 ? "" : "s"}`, quantity: b.nights, unitAmount: b.roomCharges.toNumber() / Math.max(1, b.nights), amount: b.roomCharges.toNumber() });
  }
  if (b.additionalCharges.toNumber() > 0) lineItems.push({ description: "Additional charges", quantity: 1, unitAmount: b.additionalCharges.toNumber(), amount: b.additionalCharges.toNumber() });

  return {
    version: 1,
    receiptNumber,
    issuedAt: issuedAt.toISOString(),
    issuedAtDisplay: issuedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }),
    currency: b.currency,
    currencySymbol: property.currencySymbol,
    property: {
      name: property.name,
      addressLines: [property.addressLine1, property.addressLine2, [property.city, property.state, property.postalCode].filter(Boolean).join(" "), property.country].filter(Boolean),
      phone: property.phone,
      email: property.email,
      website: publicEnv.siteUrl.replace(/^https?:\/\//, ""),
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
    },
    guest: { name: b.guestName, email: b.guestEmail, phone: b.guestPhone },
    booking: {
      reference: b.bookingReference,
      roomName: b.room.name,
      roomType: b.room.type,
      checkIn: formatDateDisplay(b.checkIn),
      checkOut: formatDateDisplay(b.checkOut),
      nights: b.nights,
      guestCount: b.guestCount,
      status: b.status,
    },
    lineItems,
    totals: {
      roomCharges: b.roomCharges.toNumber(),
      additionalCharges: b.additionalCharges.toNumber(),
      discount: b.discount.toNumber(),
      taxRate: b.taxRate.toNumber(),
      taxLabel: (snap as { taxLabel?: string } | null)?.taxLabel ?? "Tax",
      taxAmount: b.taxAmount.toNumber(),
      totalAmount: total,
      amountPaid: paid,
      balanceDue: Math.max(0, Math.round((total - paid) * 100) / 100),
    },
    payments: b.payments
      .filter((p) => SETTLED_PAYMENT_STATUSES.includes(p.status) || p.status === "PARTIAL")
      .map((p) => ({
        date: (p.paidAt ?? p.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
        methodLabel: PAYMENT_METHOD_LABELS[p.method],
        reference: p.transactionId ?? p.razorpayPaymentId ?? null,
        amount: p.amount.toNumber(),
        status: p.status,
      })),
    paymentStatusLabel: PAYMENT_STATUS_LABELS[b.paymentStatus],
    footerNote: paid + 0.005 >= total ? "Thank you — your stay is fully paid." : "The balance is payable at the property on arrival unless otherwise agreed.",
  };
}

export type ReceiptRecord = Prisma.ReceiptGetPayload<{ include: { booking: { select: { bookingReference: true; guestEmail: true; guestName: true; userId: true } } } }>;

/**
 * Issue (or return the existing) receipt for a booking. Safe to call from the payment
 * webhook, the admin confirm action and the admin "generate receipt" button concurrently:
 * the unique bookingId constraint means only one receipt can ever exist.
 */
export async function issueReceipt(bookingId: string, opts: { generatedById?: string | null; paymentId?: string | null; ipAddress?: string | null } = {}): Promise<ReceiptRecord> {
  const existing = await prisma.receipt.findUnique({ where: { bookingId }, include: receiptInclude });
  if (existing && !existing.deletedAt) return existing;

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, deletedAt: null }, include: bookingInclude });
  if (!booking) throw new NotFoundError("Booking not found.");
  if (!["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(booking.status)) {
    throw new ValidationError("Receipts can only be issued for confirmed bookings.");
  }

  const issuedAt = new Date();
  let receipt: ReceiptRecord;
  try {
    receipt = await prisma.$transaction(async (tx) => {
      const receiptNumber = await nextReceiptNumber(tx, issuedAt);
      const snapshot = await buildSnapshot(booking, receiptNumber, issuedAt, tx);
      const created = await tx.receipt.create({
        data: {
          receiptNumber,
          bookingId,
          paymentId: opts.paymentId ?? booking.payments.find((p) => SETTLED_PAYMENT_STATUSES.includes(p.status))?.id ?? null,
          issuedAt,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
          generatedById: opts.generatedById ?? null,
        },
        include: receiptInclude,
      });
      await recordAudit({ adminUserId: opts.generatedById ?? null, action: "ADMIN_GENERATED_RECEIPT", entityType: "Receipt", entityId: created.id, newValue: { receiptNumber, bookingId }, ipAddress: opts.ipAddress ?? null }, tx);
      return created;
    });
  } catch (err) {
    // Lost a race with a concurrent issue → return the winner.
    const again = await prisma.receipt.findUnique({ where: { bookingId }, include: receiptInclude });
    if (again) return again;
    throw err;
  }

  await renderAndStorePdf(receipt).catch((err) => logger.error("Receipt PDF generation failed", { receiptId: receipt.id, err }));
  return (await prisma.receipt.findUnique({ where: { id: receipt.id }, include: receiptInclude })) ?? receipt;
}

const receiptInclude = { booking: { select: { bookingReference: true, guestEmail: true, guestName: true, userId: true } } } as const;

export async function renderAndStorePdf(receipt: ReceiptRecord): Promise<ReceiptRecord> {
  const pdf = await renderReceiptPdf(receipt.snapshot as unknown as ReceiptSnapshot);
  const key = `receipts/${receipt.receiptNumber.slice(8, 12)}/${receipt.receiptNumber}.pdf`;
  const stored = await storage().put(key, pdf, "application/pdf");
  return prisma.receipt.update({
    where: { id: receipt.id },
    data: { pdfStorageKey: stored.key, pdfUrl: stored.url, lastGeneratedAt: new Date(), regenerateCount: receipt.lastGeneratedAt ? { increment: 1 } : undefined },
    include: receiptInclude,
  });
}

/** Re-render the PDF from the stored snapshot (e.g. after a storage move). Number never changes. */
export async function regenerateReceipt(receiptId: string, adminUserId: string, ipAddress?: string | null): Promise<ReceiptRecord> {
  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, deletedAt: null }, include: receiptInclude });
  if (!receipt) throw new NotFoundError("Receipt not found.");
  const updated = await renderAndStorePdf(receipt);
  await recordAudit({ adminUserId, action: "ADMIN_GENERATED_RECEIPT", entityType: "Receipt", entityId: receiptId, newValue: { regenerated: true }, ipAddress });
  return updated;
}

/** Render the PDF bytes on demand (used by the download route so no public storage URL is required). */
export async function receiptPdfBytes(receipt: ReceiptRecord): Promise<Buffer> {
  return renderReceiptPdf(receipt.snapshot as unknown as ReceiptSnapshot);
}

/**
 * After an admin confirms / records a payment: if the booking is now confirmed and fully
 * settled (PAID, CASH, UPI, bank transfer) and no receipt exists yet, issue one and email it
 * when the notifications setting allows. Never throws.
 */
export async function autoReceiptIfSettled(bookingId: string, adminUserId: string, ipAddress?: string | null): Promise<void> {
  try {
    const [booking, notifications] = await Promise.all([
      prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, paymentStatus: true, totalAmount: true, amountPaid: true, receipt: { select: { id: true } } } }),
      getSettingsGroup("notifications"),
    ]);
    if (!booking || booking.receipt) return;
    if (!["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(booking.status)) return;
    const settled = SETTLED_PAYMENT_STATUSES.includes(booking.paymentStatus) && booking.amountPaid.toNumber() + 0.005 >= booking.totalAmount.toNumber();
    if (!settled || !notifications.autoEmailReceiptOnPayment) return;
    const receipt = await issueReceipt(bookingId, { generatedById: adminUserId, ipAddress });
    await emailReceipt(receipt.id, { adminUserId, ipAddress });
  } catch (err) {
    logger.error("Automatic receipt failed", { bookingId, err });
  }
}

export async function findReceiptByNumber(receiptNumber: string): Promise<ReceiptRecord | null> {
  return prisma.receipt.findFirst({ where: { receiptNumber: receiptNumber.trim().toUpperCase(), deletedAt: null }, include: receiptInclude });
}

export async function emailReceipt(receiptId: string, opts: { adminUserId?: string | null; ipAddress?: string | null } = {}) {
  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, deletedAt: null }, include: receiptInclude });
  if (!receipt) throw new NotFoundError("Receipt not found.");
  const snap = receipt.snapshot as unknown as ReceiptSnapshot;
  const branding = await emailBranding();
  const url = `${publicEnv.siteUrl}/receipts/${encodeURIComponent(receipt.receiptNumber)}?e=${encodeURIComponent(receipt.booking.guestEmail)}`;
  const subject = `Receipt ${receipt.receiptNumber} – ${branding.propertyName}`;
  const html = layout(
    branding,
    subject,
    `<p>Dear ${escapeHtml(receipt.booking.guestName)},</p>
     <p>Please find your receipt for booking <strong>${escapeHtml(receipt.booking.bookingReference)}</strong> attached. Total ${escapeHtml(formatMoney(snap.totals.totalAmount, snap.currency))} · Paid ${escapeHtml(formatMoney(snap.totals.amountPaid, snap.currency))}.</p>
     ${button(url, "View receipt")}
     <p style="color:#6b625a;font-size:13px;">Receipt number ${escapeHtml(receipt.receiptNumber)} · issued ${escapeHtml(snap.issuedAtDisplay)}</p>`,
  );
  const text = `Dear ${receipt.booking.guestName},\n\nYour receipt ${receipt.receiptNumber} for booking ${receipt.booking.bookingReference} is available at ${url}\n\nTotal ${formatMoney(snap.totals.totalAmount, snap.currency)} · Paid ${formatMoney(snap.totals.amountPaid, snap.currency)}`;
  const pdf = await receiptPdfBytes(receipt);
  const result = await sendEmail({
    to: receipt.booking.guestEmail,
    subject,
    html,
    text,
    template: "receipt",
    bookingId: receipt.bookingId,
    receiptId: receipt.id,
    attachments: [{ filename: `${receipt.receiptNumber}.pdf`, content: pdf }],
  });
  if (opts.adminUserId) {
    await recordAudit({ adminUserId: opts.adminUserId, action: "ADMIN_SENT_RECEIPT", entityType: "Receipt", entityId: receipt.id, newValue: { to: receipt.booking.guestEmail, status: result.status }, ipAddress: opts.ipAddress ?? null });
  }
  return result;
}
