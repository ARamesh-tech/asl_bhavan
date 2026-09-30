import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { getCurrentUser } from "@/lib/auth/guards";
import { assertBookingAccess } from "@/lib/booking/access";
import { getBookingByReference } from "@/lib/booking/booking-service";
import { NotFoundError } from "@/lib/errors";
import { createCheckoutOrder } from "@/lib/payments/razorpay";
import { enforceRateLimit } from "@/lib/rate-limit";
import { bookingReferenceSchema } from "@/lib/validation/booking";

const bodySchema = z.object({
  reference: bookingReferenceSchema,
  email: z.string().trim().max(200).optional(),
});

/**
 * POST /api/payments/create-order
 * Creates a Razorpay order for the booking's outstanding balance. The amount comes from the
 * database row — the client only supplies the booking reference.
 */
export const POST = handleRoute(async (req: NextRequest) => {
  enforceRateLimit("payment", clientIp(req));
  const body = await parseBody(req, bodySchema);
  const booking = await getBookingByReference(body.reference);
  if (!booking) throw new NotFoundError("Booking not found.");
  assertBookingAccess(booking, await getCurrentUser(), body.email);
  const order = await createCheckoutOrder(booking);
  return ok(order);
});
