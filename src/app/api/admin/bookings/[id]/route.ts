import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { getBookingById, modifyBooking } from "@/lib/booking/booking-service";
import { toBookingDto } from "@/lib/booking/serialize";
import { NotFoundError } from "@/lib/errors";
import { modifyBookingSchema } from "@/lib/validation/admin";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_req: NextRequest, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const booking = await getBookingById(id);
  if (!booking) throw new NotFoundError("Booking not found.");
  return ok({ booking: toBookingDto(booking), internalNotes: booking.internalNotes });
});

/** PATCH /api/admin/bookings/:id — modify dates/room/guests/charges/notes with re-validation. */
export const PATCH = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, modifyBookingSchema);
  const ip = clientIp(req);
  const updated = await modifyBooking({
    bookingId: id,
    adminUserId: admin.id,
    roomId: body.roomId,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    guestCount: body.guestCount,
    discount: body.discount,
    additionalCharges: body.additionalCharges,
    specialRequests: body.specialRequests,
    internalNotes: body.internalNotes,
    primaryGuest: body.name || body.email || body.phone ? { name: body.name, email: body.email, phone: body.phone } : undefined,
    ipAddress: ip === "unknown" ? null : ip,
  });
  return ok({ booking: toBookingDto(updated), internalNotes: updated.internalNotes });
});
