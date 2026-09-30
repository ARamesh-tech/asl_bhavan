import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody, parseQuery } from "@/lib/api/respond";
import { getCurrentUser, requireUser } from "@/lib/auth/guards";
import { createBooking } from "@/lib/booking/booking-service";
import { listCustomerBookings } from "@/lib/booking/customer-service";
import { toBookingDto } from "@/lib/booking/serialize";
import { integrations } from "@/lib/env";
import { IntegrationDisabledError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notifyOwnerOfNewBooking } from "@/lib/booking/notifications";
import { createBookingSchema } from "@/lib/validation/booking";
import { paginationSchema, paginate } from "@/lib/validation/common";
import { z } from "zod";

/**
 * POST /api/bookings — customer creates a booking.
 *   mode=WHATSAPP → OWNER_CONFIRMATION (customer then messages the owner)
 *   mode=ONLINE   → PENDING_PAYMENT with hold; client proceeds to /api/payments/create-order
 */
export const POST = handleRoute(async (req: NextRequest) => {
  const ip = clientIp(req);
  enforceRateLimit("booking", ip);
  const input = await parseBody(req, createBookingSchema);
  const user = await getCurrentUser();

  if (input.mode === "ONLINE" && !integrations().razorpay) {
    throw new IntegrationDisabledError("Online payment");
  }

  const booking = await createBooking({
    roomId: input.roomId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guestCount: input.guestCount,
    primaryGuest: { name: input.name, email: input.email, phone: input.phone },
    additionalGuests: input.additionalGuests?.map((g) => ({ fullName: g.fullName, age: g.age ?? null })),
    specialRequests: input.specialRequests || null,
    userId: user?.id ?? null,
    mode: input.mode === "ONLINE" ? "ONLINE_PAYMENT" : "OWNER_CONFIRMATION",
    source: input.mode === "ONLINE" ? "ONLINE" : "WHATSAPP",
    ipAddress: ip === "unknown" ? null : ip,
  });

  // Owner notification is best-effort.
  void notifyOwnerOfNewBooking(booking.id).catch((err) => logger.warn("Owner booking notification failed", { err }));

  return ok({ booking: toBookingDto(booking) }, { status: 201 });
});

const listSchema = paginationSchema.extend({
  scope: z.enum(["upcoming", "past", "cancelled", "all"]).default("all"),
});

/** GET /api/bookings — the signed-in customer's own bookings. */
export const GET = handleRoute(async (req: NextRequest) => {
  const user = await requireUser();
  const q = parseQuery(req, listSchema);
  const { rows, total } = await listCustomerBookings(user, q.scope, q.page, q.pageSize);
  return ok(paginate(rows.map(toBookingDto), total, q));
});
