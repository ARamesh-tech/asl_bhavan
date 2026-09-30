import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkoutSignatureValid, webhookSignatureValid } from "@/lib/payments/signature";
import { toCsv } from "@/lib/admin/bookings-service";
import { receiptNumberSchema, bookingReferenceSchema } from "@/lib/validation/booking";

describe("Razorpay checkout signature", () => {
  const secret = "test_key_secret_123";
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";
  const good = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

  it("accepts the correct HMAC", () => {
    expect(checkoutSignatureValid(orderId, paymentId, good, secret)).toBe(true);
  });
  it("rejects a tampered payment id", () => {
    expect(checkoutSignatureValid(orderId, "pay_OTHER", good, secret)).toBe(false);
  });
  it("rejects a wrong-length or empty signature without throwing", () => {
    expect(checkoutSignatureValid(orderId, paymentId, "abc", secret)).toBe(false);
    expect(checkoutSignatureValid(orderId, paymentId, "", secret)).toBe(false);
  });
  it("rejects when the secret is not configured", () => {
    expect(checkoutSignatureValid(orderId, paymentId, good, undefined)).toBe(false);
  });
});

describe("Razorpay webhook signature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 150000 } } } });
  const good = createHmac("sha256", secret).update(body).digest("hex");

  it("verifies against the raw body", () => {
    expect(webhookSignatureValid(body, good, secret)).toBe(true);
  });
  it("fails if the body was re-serialised differently", () => {
    expect(webhookSignatureValid(JSON.stringify(JSON.parse(body), null, 2), good, secret)).toBe(false);
  });
  it("fails with a missing header", () => {
    expect(webhookSignatureValid(body, null, secret)).toBe(false);
  });
});

describe("CSV export hardening", () => {
  it("escapes quotes, commas and newlines", () => {
    const csv = toCsv([["a", "b"], ['He said "hi"', "x,y\nz"]]);
    expect(csv).toContain('"He said ""hi"""');
    expect(csv).toContain('"x,y\nz"');
  });
  it("neutralises spreadsheet formula injection", () => {
    const csv = toCsv([["v"], ["=HYPERLINK(\"http://evil\")"], ["+1"], ["-2"], ["@cmd"]]);
    for (const line of csv.split("\n").slice(1)) {
      if (!line) continue;
      expect(line.replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });
});

describe("public identifiers", () => {
  it("accepts well-formed receipt numbers and normalises case", () => {
    expect(receiptNumberSchema.parse(" asl-rcp-20260930-0001 ")).toBe("ASL-RCP-20260930-0001");
  });
  it("rejects malformed receipt numbers / references", () => {
    expect(receiptNumberSchema.safeParse("ASL-RCP-2026-1").success).toBe(false);
    expect(bookingReferenceSchema.safeParse("ASL-20260930-1").success).toBe(false);
    expect(bookingReferenceSchema.safeParse("ASL-20260930-A001").success).toBe(true);
  });
});
