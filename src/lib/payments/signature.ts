import { createHmac, timingSafeEqual } from "node:crypto";

/** Pure HMAC helpers for Razorpay — kept dependency-free so they are trivially unit-testable. */

function safeEqualUtf8(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Razorpay Checkout: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function checkoutSignatureValid(orderId: string, paymentId: string, signature: string, keySecret: string | undefined): boolean {
  if (!keySecret || !signature) return false;
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualUtf8(expected, signature);
}

/** Razorpay Webhook: HMAC_SHA256(raw_body, webhook_secret) compared with X-Razorpay-Signature. */
export function webhookSignatureValid(rawBody: string, signature: string | null | undefined, webhookSecret: string | undefined): boolean {
  if (!webhookSecret || !signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualUtf8(expected, signature);
}
