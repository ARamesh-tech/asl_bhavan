import "server-only";
import Razorpay from "razorpay";
import { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit";
import { checkUnitAvailability } from "@/lib/booking/availability-service";
import { bookingInclude, type BookingWithRelations } from "@/lib/booking/booking-service";
import { prisma } from "@/lib/db/prisma";
import { getEnv, integrations } from "@/lib/env";
import { AppError, ConflictError, IntegrationDisabledError, NotFoundError, PaymentError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { toPaise } from "@/lib/money";
import { checkoutSignatureValid, webhookSignatureValid } from "./signature";

/**
 * Razorpay integration. All secret-bearing calls happen here on the server:
 *   1. createOrder      — amount is computed from the booking row, never from the client
 *   2. verifyCheckout   — HMAC(order_id|payment_id) with RAZORPAY_KEY_SECRET
 *   3. handleWebhook    — HMAC(raw body) with RAZORPAY_WEBHOOK_SECRET, idempotent by event id
 *   4. refund           — admin-only
 * Both 2 and 3 funnel into `settleOnlinePayment`, which is idempotent, so whichever arrives
 * first (browser callback or webhook) confirms the booking and the other is a no-op.
 */

let client: Razorpay | null = null;
export function razorpay(): Razorpay {
  const env = getEnv();
  if (!integrations().razorpay) throw new IntegrationDisabledError("Online payment");
  if (!client) client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! });
  return client;
}

export type CheckoutOrder = {
  orderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
  bookingReference: string;
  prefill: { name: string; email: string; contact: string };
  description: string;
};

/**
 * Create (or reuse) a Razorpay order for the outstanding balance of a PENDING_PAYMENT booking.
 * The Payment row is created in PENDING with the order id so the webhook can find it.
 */
export async function createCheckoutOrder(booking: BookingWithRelations): Promise<CheckoutOrder> {
  if (booking.status !== "PENDING_PAYMENT") {
    throw new ConflictError(
      booking.status === "EXPIRED"
        ? "This booking's payment window has expired. Please start a new booking."
        : "This booking is not awaiting online payment.",
    );
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    throw new ConflictError("This booking's payment window has expired. Please start a new booking.");
  }
  const balance = booking.totalAmount.toNumber() - booking.amountPaid.toNumber();
  const amountPaise = toPaise(balance);
  if (amountPaise < 100) throw new ValidationError("Nothing to pay for this booking.");

  const env = getEnv();
  const prefill = { name: booking.guestName, email: booking.guestEmail, contact: booking.guestPhone };
  const description = `Booking ${booking.bookingReference}`;

  // Reuse an open order created in the last ~10 minutes to avoid piling up orders on refresh.
  const open = booking.payments.find(
    (p) => p.method === "RAZORPAY" && p.status === "PENDING" && p.razorpayOrderId && !p.deletedAt && p.amount.toNumber() === balance && Date.now() - p.createdAt.getTime() < 10 * 60_000,
  );
  if (open?.razorpayOrderId) {
    return { orderId: open.razorpayOrderId, amount: amountPaise, currency: booking.currency, keyId: env.RAZORPAY_KEY_ID!, bookingReference: booking.bookingReference, prefill, description };
  }

  const order = await razorpay().orders.create({
    amount: amountPaise,
    currency: booking.currency,
    receipt: booking.bookingReference,
    notes: { bookingReference: booking.bookingReference },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amount: new Prisma.Decimal(balance.toFixed(2)),
      currency: booking.currency,
      method: "RAZORPAY",
      status: "PENDING",
      razorpayOrderId: order.id,
    },
  });

  return { orderId: order.id, amount: amountPaise, currency: booking.currency, keyId: env.RAZORPAY_KEY_ID!, bookingReference: booking.bookingReference, prefill, description };
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  return checkoutSignatureValid(orderId, paymentId, signature, getEnv().RAZORPAY_KEY_SECRET);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  return webhookSignatureValid(rawBody, signature, getEnv().RAZORPAY_WEBHOOK_SECRET);
}

export type SettleResult = { outcome: "CONFIRMED" | "ALREADY_SETTLED" | "NEEDS_ATTENTION"; bookingId: string; paymentId: string };

/**
 * Mark a Razorpay payment as captured and confirm the booking. Idempotent: a second call
 * for the same razorpay payment id returns ALREADY_SETTLED without changing anything.
 *
 * Edge case: if the hold expired (and was released) between checkout open and capture, we
 * re-check availability under the room lock. If the unit is still free the booking is revived
 * and confirmed; otherwise the payment is recorded as PAID on an EXPIRED booking and flagged
 * for the admin to refund — the guest is never double-booked.
 */
export async function settleOnlinePayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string | null;
  amountPaise?: number | null;
  method?: string | null;
  source: "CHECKOUT" | "WEBHOOK";
}): Promise<SettleResult> {
  return prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findFirst({ where: { razorpayOrderId: input.razorpayOrderId, deletedAt: null }, include: { booking: true } });
      if (!payment) throw new NotFoundError("No payment found for this order.");
      const booking = payment.booking;

      if (payment.status === "PAID" && payment.razorpayPaymentId === input.razorpayPaymentId) {
        return { outcome: "ALREADY_SETTLED", bookingId: booking.id, paymentId: payment.id } as SettleResult;
      }
      if (payment.status === "PAID") {
        throw new ConflictError("This order has already been paid with a different payment id.");
      }

      // Amount check when the provider tells us (webhook / fetched payment).
      const expectedPaise = toPaise(payment.amount.toNumber());
      if (input.amountPaise != null && input.amountPaise !== expectedPaise) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: `Amount mismatch: expected ${expectedPaise} paise, got ${input.amountPaise}` } });
        await recordAudit({ action: "SYSTEM_PAYMENT_NEEDS_ATTENTION", entityType: "Payment", entityId: payment.id, newValue: { reason: "AMOUNT_MISMATCH", expectedPaise, gotPaise: input.amountPaise } }, tx);
        throw new PaymentError("Payment amount did not match the booking total.");
      }

      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${booking.roomId} FOR UPDATE`;

      const now = new Date();
      const newPaid = booking.amountPaid.toNumber() + payment.amount.toNumber();
      const fullyPaid = newPaid + 0.005 >= booking.totalAmount.toNumber();

      let canConfirm = booking.status === "PENDING_PAYMENT";
      if (booking.status === "EXPIRED") {
        const availability = await checkUnitAvailability(tx, {
          roomId: booking.roomId,
          range: { start: booking.checkIn, end: booking.checkOut },
          guestCount: booking.guestCount,
          excludeBookingId: booking.id,
        });
        canConfirm = availability.isAvailable;
      } else if (["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(booking.status)) {
        canConfirm = true; // paying a balance on an already-confirmed booking
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          razorpayPaymentId: input.razorpayPaymentId,
          razorpaySignature: input.razorpaySignature ?? undefined,
          paidAt: now,
          failureReason: null,
          metadata: { source: input.source, providerMethod: input.method ?? null },
        },
      });

      if (!canConfirm) {
        await tx.booking.update({ where: { id: booking.id }, data: { amountPaid: newPaid, paymentStatus: fullyPaid ? "PAID" : "PARTIAL" } });
        await recordAudit(
          {
            action: "SYSTEM_PAYMENT_NEEDS_ATTENTION",
            entityType: "Booking",
            entityId: booking.id,
            newValue: { reason: "PAID_AFTER_EXPIRY_UNAVAILABLE", bookingReference: booking.bookingReference, razorpayPaymentId: input.razorpayPaymentId, amount: payment.amount },
          },
          tx,
        );
        logger.warn("Payment captured for expired booking whose dates are no longer available; refund required", { bookingId: booking.id });
        return { outcome: "NEEDS_ATTENTION", bookingId: booking.id, paymentId: payment.id } as SettleResult;
      }

      const wasPending = booking.status === "PENDING_PAYMENT" || booking.status === "EXPIRED";
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: wasPending ? "CONFIRMED" : booking.status,
          paymentStatus: fullyPaid ? "PAID" : "PARTIAL",
          amountPaid: newPaid,
          holdExpiresAt: null,
          confirmedAt: booking.confirmedAt ?? now,
        },
      });
      await recordAudit(
        {
          action: "SYSTEM_PAYMENT_CONFIRMED",
          entityType: "Booking",
          entityId: booking.id,
          oldValue: { status: booking.status, paymentStatus: booking.paymentStatus },
          newValue: { status: wasPending ? "CONFIRMED" : booking.status, paymentStatus: fullyPaid ? "PAID" : "PARTIAL", razorpayPaymentId: input.razorpayPaymentId, amount: payment.amount, source: input.source },
        },
        tx,
      );
      return { outcome: "CONFIRMED", bookingId: booking.id, paymentId: payment.id } as SettleResult;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5_000, timeout: 20_000 },
  );
}

export async function markOnlinePaymentFailed(razorpayOrderId: string, reason: string | null) {
  const payment = await prisma.payment.findFirst({ where: { razorpayOrderId, deletedAt: null } });
  if (!payment || payment.status === "PAID") return;
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason?.slice(0, 500) ?? "Payment failed" } });
  await recordAudit({ action: "SYSTEM_PAYMENT_FAILED", entityType: "Payment", entityId: payment.id, newValue: { razorpayOrderId, reason } });
  // Booking stays PENDING_PAYMENT until the hold expires so the guest can retry.
}

export async function applyRefundFromProvider(input: { razorpayPaymentId: string; refundId: string; amountPaise: number; source: "WEBHOOK" | "ADMIN"; adminUserId?: string | null }) {
  const payment = await prisma.payment.findFirst({ where: { razorpayPaymentId: input.razorpayPaymentId, deletedAt: null }, include: { booking: true } });
  if (!payment) return;
  if (payment.refundId === input.refundId) return; // already applied
  const refunded = Math.min(payment.amount.toNumber(), payment.refundedAmount.toNumber() + input.amountPaise / 100);
  const fullyRefunded = refunded + 0.005 >= payment.amount.toNumber();
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { refundedAmount: refunded, refundId: input.refundId, refundedAt: new Date(), status: fullyRefunded ? "REFUNDED" : payment.status },
    });
    const bookingPaid = Math.max(0, payment.booking.amountPaid.toNumber() - input.amountPaise / 100);
    await tx.booking.update({
      where: { id: payment.bookingId },
      data: { amountPaid: bookingPaid, paymentStatus: bookingPaid <= 0.005 ? "REFUNDED" : "PARTIAL" },
    });
    await recordAudit(
      {
        adminUserId: input.adminUserId ?? null,
        action: input.source === "ADMIN" ? "ADMIN_REFUNDED_PAYMENT" : "SYSTEM_PAYMENT_REFUNDED",
        entityType: "Payment",
        entityId: payment.id,
        newValue: { refundId: input.refundId, amount: input.amountPaise / 100, fullyRefunded },
      },
      tx,
    );
  });
}

/** Admin-initiated refund via Razorpay. Amount in rupees; defaults to the full remaining amount. */
export async function refundOnlinePayment(paymentId: string, adminUserId: string, amount?: number | null, notes?: string | null) {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, deletedAt: null } });
  if (!payment) throw new NotFoundError("Payment not found.");
  if (payment.method !== "RAZORPAY" || !payment.razorpayPaymentId) throw new ValidationError("Only Razorpay payments can be refunded online. Record manual refunds as notes.");
  const remaining = payment.amount.toNumber() - payment.refundedAmount.toNumber();
  const value = amount ?? remaining;
  if (value <= 0 || value > remaining + 0.005) throw new ValidationError(`Refund amount must be between 0 and ${remaining.toFixed(2)}.`);
  const refund = await razorpay().payments.refund(payment.razorpayPaymentId, {
    amount: toPaise(value),
    notes: notes ? { reason: notes.slice(0, 250) } : undefined,
  });
  await applyRefundFromProvider({ razorpayPaymentId: payment.razorpayPaymentId, refundId: refund.id, amountPaise: Number(refund.amount ?? toPaise(value)), source: "ADMIN", adminUserId });
  return refund.id;
}

type WebhookPayload = {
  event: string;
  payload?: {
    payment?: { entity?: { id: string; order_id?: string; amount?: number; method?: string; error_description?: string | null; error_reason?: string | null } };
    refund?: { entity?: { id: string; payment_id: string; amount: number } };
  };
};

/** Process a verified webhook body. Idempotent on (provider, eventId). */
export type WebhookResult = { duplicate: boolean; settle?: SettleResult; rejected?: string };

export async function handleWebhookEvent(eventId: string, body: WebhookPayload): Promise<WebhookResult> {
  const existing = await prisma.paymentEvent.findUnique({ where: { provider_eventId: { provider: "razorpay", eventId } } });
  if (existing?.processedAt) return { duplicate: true };
  let settle: SettleResult | undefined;

  const paymentEntity = body.payload?.payment?.entity;
  const linked = paymentEntity?.order_id ? await prisma.payment.findFirst({ where: { razorpayOrderId: paymentEntity.order_id }, select: { id: true } }) : null;

  const event = existing
    ? existing
    : await prisma.paymentEvent.create({
        data: { provider: "razorpay", eventId, eventType: body.event, paymentId: linked?.id ?? null, payload: body as unknown as Prisma.InputJsonValue },
      });

  try {
    switch (body.event) {
      case "payment.captured": {
        if (!paymentEntity?.order_id) break;
        settle = await settleOnlinePayment({ razorpayOrderId: paymentEntity.order_id, razorpayPaymentId: paymentEntity.id, amountPaise: paymentEntity.amount ?? null, method: paymentEntity.method ?? null, source: "WEBHOOK" });
        break;
      }
      case "payment.failed": {
        if (!paymentEntity?.order_id) break;
        await markOnlinePaymentFailed(paymentEntity.order_id, paymentEntity.error_description ?? paymentEntity.error_reason ?? null);
        break;
      }
      case "refund.processed":
      case "refund.created": {
        const r = body.payload?.refund?.entity;
        if (!r) break;
        await applyRefundFromProvider({ razorpayPaymentId: r.payment_id, refundId: r.id, amountPaise: r.amount, source: "WEBHOOK" });
        break;
      }
      default:
        // Unhandled event types are stored for audit but need no action.
        break;
    }
    await prisma.paymentEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
    return { duplicate: false, settle };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.paymentEvent.update({ where: { id: event.id }, data: { error: message.slice(0, 1000) } });
    // Business-rule rejections (mismatch etc.) are final — acknowledge so Razorpay stops retrying.
    if (err instanceof AppError && err.status < 500) return { duplicate: false, rejected: message };
    throw err;
  }
}
