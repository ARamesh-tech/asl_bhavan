import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, handleRoute, ok, parseQuery } from "@/lib/api/respond";
import { checkUnitAvailability } from "@/lib/booking/availability-service";
import { addDays, formatDateOnly, nightsBetween, todayInTimeZone } from "@/lib/booking/dates";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { dateOnlySchema } from "@/lib/validation/common";

const querySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

/**
 * GET /api/rooms/[slug]/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Per-night availability for one unit (max 120 nights). Public, read-only, live data.
 */
export const GET = handleRoute<{ params: Promise<{ slug: string }> }>(async (req: NextRequest, { params }) => {
  enforceRateLimit("availability", clientIp(req));
  const { slug } = await params;
  const q = parseQuery(req, querySchema);

  const room = await prisma.room.findFirst({
    where: { slug, deletedAt: null, isActive: true },
    select: { id: true, type: true, capacity: true },
  });
  if (!room) throw new NotFoundError("Room not found.");

  const today = todayInTimeZone();
  const from = q.from && q.from > today ? q.from : today;
  const to = q.to ?? addDays(from, 60);
  const nights = nightsBetween(from, to);
  if (nights <= 0) throw new ValidationError("`to` must be after `from`.");
  if (nights > 120) throw new ValidationError("Range too large (max 120 nights).");

  const availability = await checkUnitAvailability(prisma, { roomId: room.id, range: { start: from, end: to }, guestCount: 1 });
  return ok(
    {
      roomId: room.id,
      type: room.type,
      capacity: room.type === "DORMITORY" ? room.capacity : 1,
      from: formatDateOnly(from),
      to: formatDateOnly(to),
      nights: availability.perNight.map((n) => ({ date: n.date, available: n.available, status: n.status })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
