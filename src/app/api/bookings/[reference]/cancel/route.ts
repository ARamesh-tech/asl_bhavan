import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { getCurrentUser } from "@/lib/auth/guards";
import { assertBookingAccess } from "@/lib/booking/access";
import { cancelBooking, getBookingByReference } from "@/lib/booking/booking-service";
import { sendBookingCancelledEmail } from "@/lib/booking/notifications";
import { toBookingDto } from "@/lib/booking/serialize";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { bookingReferenceSchema, cancelBookingSchema } from "@/lib/validation/booking";
import { z } from "zod";

const bodySchema = cancelBookingSchema.extend({ email: z.string().trim().max(200).optional() });

/** POST /api/bookings/:reference/cancel — customer-initiated cancellation (policy enforced). */
export const POST = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ reference: string }> }) => {
  const { reference } = await ctx.params;
  const parsedRef = bookingReferenceSchema.safeParse(reference);
  if (!parsedRef.success) throw new NotFoundError("Booking not found.");
  const body = await parseBody(req, bodySchema);

  const booking = await getBookingByReference(parsedRef.data);
  if (!booking) throw new NotFoundError("Booking not found.");
  const user = await getCurrentUser();
  assertBookingAccess(booking, user, body.email);

  const ip = clientIp(req);
  const updated = await cancelBooking({
    bookingId: booking.id,
    cancelledById: user?.id ?? null,
    reason: body.reason ?? null,
    byCustomer: true,
    ipAddress: ip === "unknown" ? null : ip,
  });
  void sendBookingCancelledEmail(updated.id).catch((err) => logger.warn("Cancellation email failed", { err }));
  return ok({ booking: toBookingDto(updated) });
});
