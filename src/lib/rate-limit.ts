import "server-only";
import { RateLimitedError } from "./errors";

/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single Render web service instance (the intended deployment). If the app
 * is ever scaled horizontally, swap the store for Redis/Upstash behind the same interface.
 */

type Bucket = { hits: number[]; };

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) store.delete(key);
  }
}

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  forgotPassword: { limit: 5, windowMs: 60 * 60_000 },
  contact: { limit: 5, windowMs: 60 * 60_000 },
  booking: { limit: 20, windowMs: 60 * 60_000 },
  payment: { limit: 30, windowMs: 15 * 60_000 },
  webhook: { limit: 600, windowMs: 60_000 },
  availability: { limit: 120, windowMs: 60_000 },
  api: { limit: 300, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export function checkRateLimit(key: string, rule: RateLimitRule, now = Date.now()): { ok: boolean; remaining: number; retryAfterMs: number } {
  sweep(now, rule.windowMs);
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < rule.windowMs);
  if (bucket.hits.length >= rule.limit) {
    const oldest = bucket.hits[0]!;
    store.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterMs: rule.windowMs - (now - oldest) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  return { ok: true, remaining: rule.limit - bucket.hits.length, retryAfterMs: 0 };
}

/** Throws RateLimitedError when the caller exceeded the rule. */
export function enforceRateLimit(scope: keyof typeof RATE_LIMITS, identifier: string): void {
  const rule = RATE_LIMITS[scope];
  const res = checkRateLimit(`${scope}:${identifier}`, rule);
  if (!res.ok) throw new RateLimitedError();
}

/** Test helper */
export function resetRateLimits(): void {
  store.clear();
}
