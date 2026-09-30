import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute, ok, parseQuery } from "@/lib/api/respond";
import { getCurrentUser } from "@/lib/auth/guards";
import { assertBookingAccess } from "@/lib/booking/access";
import { getBookingByReference } from "@/lib/booking/booking-service";
import { bookingWhatsappUrl } from "@/lib/booking/notifications";
import { toBookingDto } from "@/lib/booking/serialize";
import { NotFoundError } from "@/lib/errors";
import { bookingReferenceSchema } from "@/lib/validation/booking";

const querySchema = z.object({ email: z.string().trim().max(200).optional() });

/** GET /api/bookings/:reference?email= — customer view of one booking. */
export const GET = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ reference: string }> }) => {
  const { reference } = await ctx.params;
  const parsedRef = bookingReferenceSchema.safeParse(reference);
  if (!parsedRef.success) throw new NotFoundError("Booking not found.");
  const q = parseQuery(req, querySchema);

  const booking = await getBookingByReference(parsedRef.data);
  if (!booking) throw new NotFoundError("Booking not found.");
  assertBookingAccess(booking, await getCurrentUser(), q.email);

  const whatsappUrl = booking.status === "OWNER_CONFIRMATION" ? await bookingWhatsappUrl(booking) : null;
  return ok({ booking: toBookingDto(booking), whatsappUrl });
});
