import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import {
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  confirmBookingManually,
  markNoShow,
  recordManualPayment,
  softDeleteBooking,
} from "@/lib/booking/booking-service";
import { parseDateOnly } from "@/lib/booking/dates";
import { sendBookingCancelledEmail, sendBookingConfirmedEmail } from "@/lib/booking/notifications";
import { toBookingDto } from "@/lib/booking/serialize";
import { logger } from "@/lib/logger";
import { autoReceiptIfSettled } from "@/lib/receipts/service";
import { bookingActionSchema } from "@/lib/validation/admin";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/bookings/:id/actions — state transitions and payment recording. */
export const POST = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, bookingActionSchema);
  const ipRaw = clientIp(req);
  const ipAddress = ipRaw === "unknown" ? null : ipRaw;
  const fireEmail = (p: Promise<unknown>) => void p.catch((err) => logger.warn("Booking email failed", { err }));

  switch (body.action) {
    case "CONFIRM": {
      const updated = await confirmBookingManually({
        bookingId: id,
        adminUserId: admin.id,
        paymentMethod: body.paymentMethod,
        paymentStatus: body.paymentStatus,
        amountReceived: body.amountReceived,
        transactionId: body.transactionId ?? null,
        paymentDate: body.paymentDate ? parseDateOnly(body.paymentDate) : null,
        notes: body.notes ?? null,
        ipAddress,
      });
      if (body.sendEmail) fireEmail(sendBookingConfirmedEmail(updated.id));
      fireEmail(autoReceiptIfSettled(updated.id, admin.id, ipAddress));
      return ok({ booking: toBookingDto(updated) });
    }
    case "CANCEL": {
      const updated = await cancelBooking({ bookingId: id, cancelledById: admin.id, reason: body.reason ?? null, byCustomer: false, ipAddress });
      if (body.sendEmail) fireEmail(sendBookingCancelledEmail(updated.id));
      return ok({ booking: toBookingDto(updated) });
    }
    case "CHECK_IN":
      return ok({ booking: toBookingDto(await checkInBooking(id, admin.id, ipAddress)) });
    case "CHECK_OUT":
      return ok({ booking: toBookingDto(await checkOutBooking(id, admin.id, ipAddress)) });
    case "NO_SHOW":
      return ok({ booking: toBookingDto(await markNoShow(id, admin.id, ipAddress)) });
    case "RECORD_PAYMENT": {
      const updated = await recordManualPayment({
        bookingId: id,
        adminUserId: admin.id,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        transactionId: body.transactionId ?? null,
        paymentDate: body.paymentDate ? parseDateOnly(body.paymentDate) : null,
        notes: body.notes ?? null,
        ipAddress,
      });
      fireEmail(autoReceiptIfSettled(updated.id, admin.id, ipAddress));
      return ok({ booking: toBookingDto(updated) });
    }
    case "DELETE":
      await softDeleteBooking(id, admin.id, ipAddress);
      return ok({ deleted: true });
  }
});
