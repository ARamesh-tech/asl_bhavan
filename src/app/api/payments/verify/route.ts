import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { getCurrentUser } from "@/lib/auth/guards";
import { assertBookingAccess } from "@/lib/booking/access";
import { getBookingById } from "@/lib/booking/booking-service";
import { toBookingDto } from "@/lib/booking/serialize";
import { NotFoundError, PaymentError } from "@/lib/errors";
import { afterPaymentSettled } from "@/lib/payments/after-settlement";
import { settleOnlinePayment, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { enforceRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(100),
  razorpay_payment_id: z.string().trim().min(1).max(100),
  razorpay_signature: z.string().trim().min(1).max(200),
  email: z.string().trim().max(200).optional(),
});

/**
 * POST /api/payments/verify — called by the browser after Razorpay Checkout succeeds.
 * Verifies HMAC(order|payment) with the key secret, then settles the payment. The webhook
 * performs the same settlement independently, so the booking is confirmed even if the guest
 * closes the tab before this request completes.
 */
export const POST = handleRoute(async (req: NextRequest) => {
  enforceRateLimit("payment", clientIp(req));
  const body = await parseBody(req, bodySchema);

  if (!verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
    throw new PaymentError("Payment signature could not be verified. If money was deducted it will be reconciled automatically.");
  }

  const result = await settleOnlinePayment({
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    razorpaySignature: body.razorpay_signature,
    source: "CHECKOUT",
  });

  const booking = await getBookingById(result.bookingId);
  if (!booking) throw new NotFoundError("Booking not found.");
  assertBookingAccess(booking, await getCurrentUser(), body.email);

  if (result.outcome === "CONFIRMED") void afterPaymentSettled(result);

  return ok({ outcome: result.outcome, booking: toBookingDto(booking) });
});
