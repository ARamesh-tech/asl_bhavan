import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/** 256-bit URL-safe random token (sent to the client / embedded in links). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** One-way digest stored in the DB; the raw token is never persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Sign a value with SESSION_SECRET so a tampered cookie is rejected before touching the DB.
 * Format: `${value}.${hmac}`
 */
export function signValue(value: string): string {
  const mac = createHmac("sha256", getEnv().SESSION_SECRET).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function unsignValue(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac("sha256", getEnv().SESSION_SECRET).update(value).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}
