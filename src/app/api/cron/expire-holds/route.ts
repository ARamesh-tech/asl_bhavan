import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { handleRoute, ok } from "@/lib/api/respond";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { expirePendingHolds } from "@/lib/booking/booking-service";
import { prisma } from "@/lib/db/prisma";
import { integrations } from "@/lib/env";
import { UnauthorizedError } from "@/lib/errors";
import { syncInstagram } from "@/lib/instagram/sync";

/**
 * Housekeeping endpoint for an external scheduler (Render cron job, cron-job.org, etc.).
 * Call every few minutes with `Authorization: Bearer $CRON_SECRET`.
 *
 * Expiring holds is also done lazily inside every booking transaction, so this is a
 * safety net that keeps the admin calendar tidy — not a correctness requirement.
 */
function authorize(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new UnauthorizedError("CRON_SECRET is not configured.");
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedError();
}

async function run(req: NextRequest) {
  authorize(req);
  const [expired, sessionsPurged] = await Promise.all([expirePendingHolds(prisma), purgeExpiredSessions()]);
  // Optional: `?instagram=1` also refreshes Instagram posts (run this hourly or daily, not every minute).
  const instagram = req.nextUrl.searchParams.get("instagram") === "1" && integrations().instagram ? await syncInstagram({ limit: 30 }) : null;
  return ok({ expiredBookings: expired, sessionsPurged, instagram, at: new Date().toISOString() });
}

export const GET = handleRoute(run);
export const POST = handleRoute(run);
