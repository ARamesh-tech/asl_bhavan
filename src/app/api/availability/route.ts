import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseQuery } from "@/lib/api/respond";
import { getAvailableRooms, validateSearchRange } from "@/lib/booking/availability-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSettingsGroup } from "@/lib/settings/service";
import { availabilityQuerySchema } from "@/lib/validation/booking";

/**
 * GET /api/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N[&roomId=]
 * Live availability + server-calculated quotes for every active unit.
 */
export const GET = handleRoute(async (req: NextRequest) => {
  enforceRateLimit("availability", clientIp(req));
  const q = parseQuery(req, availabilityQuerySchema);
  const settings = await getSettingsGroup("booking");
  validateSearchRange(q.checkIn, q.checkOut, q.guests, settings);

  const results = await getAvailableRooms({ checkIn: q.checkIn, checkOut: q.checkOut, guestCount: q.guests, roomId: q.roomId });
  return ok(
    {
      checkIn: q.checkIn.toISOString().slice(0, 10),
      checkOut: q.checkOut.toISOString().slice(0, 10),
      guests: q.guests,
      results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
