import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody, parseQuery } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { adminBookingFilterSchema, listAdminBookings } from "@/lib/admin/bookings-service";
import { createBooking } from "@/lib/booking/booking-service";
import { sendBookingConfirmedEmail } from "@/lib/booking/notifications";
import { toBookingDto } from "@/lib/booking/serialize";
import { logger } from "@/lib/logger";
import { manualBookingSchema } from "@/lib/validation/admin";
import { paginate } from "@/lib/validation/common";

export const GET = handleRoute(async (req: NextRequest) => {
  await requireAdmin();
  const filters = parseQuery(req, adminBookingFilterSchema);
  const { rows, total } = await listAdminBookings(filters);
  return ok(paginate(rows.map(toBookingDto), total, filters));
});

/** POST /api/admin/bookings — manual booking (phone / walk-in / WhatsApp). */
export const POST = handleRoute(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const body = await parseBody(req, manualBookingSchema);
  const ip = clientIp(req);
  const booking = await createBooking({
    roomId: body.roomId,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    guestCount: body.guestCount,
    primaryGuest: { name: body.name, email: body.email, phone: body.phone },
    specialRequests: body.specialRequests ?? null,
    mode: "MANUAL",
    source: body.source,
    createdById: admin.id,
    manual: {
      status: body.status,
      discount: body.discount,
      additionalCharges: body.additionalCharges,
      paymentStatus: body.paymentStatus,
      paymentMethod: body.paymentMethod,
      amountReceived: body.amountReceived,
      transactionId: body.transactionId ?? null,
      internalNotes: body.internalNotes ?? null,
      allowPastDates: body.allowPastDates,
    },
    ipAddress: ip === "unknown" ? null : ip,
  });
  if (body.sendEmail && booking.status === "CONFIRMED") {
    void sendBookingConfirmedEmail(booking.id).catch((err) => logger.warn("Confirmation email failed", { err }));
  }
  return ok({ booking: toBookingDto(booking) }, { status: 201 });
});
