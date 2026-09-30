import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/api/respond";
import { integrations } from "@/lib/env";
import { logger } from "@/lib/logger";
import { afterPaymentSettled } from "@/lib/payments/after-settlement";
import { handleWebhookEvent, verifyWebhookSignature } from "@/lib/payments/razorpay";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/payments/webhook — Razorpay webhook receiver.
 *   - Signature verified over the *raw* body with RAZORPAY_WEBHOOK_SECRET
 *   - Idempotent on x-razorpay-event-id (PaymentEvent unique constraint)
 *   - Always returns 200 once accepted so Razorpay does not retry; 4xx for bad signature.
 * Configure in Razorpay Dashboard → Webhooks with events: payment.captured, payment.failed,
 * refund.processed.
 */
export async function POST(req: NextRequest) {
  try {
    enforceRateLimit("webhook", clientIp(req));
  } catch {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  if (!integrations().razorpayWebhook) {
    return NextResponse.json({ ok: false, error: "Webhook secret not configured" }, { status: 503 });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    logger.warn("Razorpay webhook signature mismatch", { ip: clientIp(req) });
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  let body: { event: string; payload?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const eventId = req.headers.get("x-razorpay-event-id") ?? `no-id:${body.event}:${hashOf(raw)}`;

  try {
    const result = await handleWebhookEvent(eventId, body);
    // Only the call that actually flipped the booking to CONFIRMED sends the emails/receipt,
    // so a browser callback + webhook pair never produces duplicates.
    if (result.settle?.outcome === "CONFIRMED") await afterPaymentSettled(result.settle);
    return NextResponse.json({ ok: true, duplicate: result.duplicate, rejected: result.rejected ?? null });
  } catch (err) {
    logger.error("Razorpay webhook processing failed", { eventId, event: body.event, err });
    return NextResponse.json({ ok: false, error: "Processing failed" }, { status: 500 });
  }
}

function hashOf(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
