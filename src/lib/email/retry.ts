import "server-only";
import { recordAudit } from "@/lib/audit";
import { notifyOwnerOfNewBooking, sendBookingCancelledEmail, sendBookingConfirmedEmail, sendBookingRequestEmail } from "@/lib/booking/notifications";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { emailReceipt } from "@/lib/receipts/service";

/**
 * Admin "resend" for a failed email. Booking/receipt emails are re-rendered from current
 * data (so a fixed email address or updated settings take effect) and logged as a new row.
 * Security emails (verification / password reset) carry one-time tokens and cannot be
 * replayed; the user must request a new one.
 */
export async function resendEmailLog(emailLogId: string, adminUserId: string, ipAddress?: string | null) {
  const log = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!log) throw new NotFoundError("Email log not found.");

  switch (log.template) {
    case "booking-request":
      if (!log.bookingId) throw new ValidationError("This email is no longer linked to a booking.");
      await sendBookingRequestEmail(log.bookingId);
      break;
    case "booking-confirmed":
      if (!log.bookingId) throw new ValidationError("This email is no longer linked to a booking.");
      await sendBookingConfirmedEmail(log.bookingId);
      break;
    case "booking-cancelled":
      if (!log.bookingId) throw new ValidationError("This email is no longer linked to a booking.");
      await sendBookingCancelledEmail(log.bookingId);
      break;
    case "owner-new-booking":
      if (!log.bookingId) throw new ValidationError("This email is no longer linked to a booking.");
      await notifyOwnerOfNewBooking(log.bookingId);
      break;
    case "receipt":
      if (!log.receiptId) throw new ValidationError("This email is no longer linked to a receipt.");
      await emailReceipt(log.receiptId, { adminUserId, ipAddress });
      break;
    default:
      throw new ValidationError("This type of email cannot be resent from the dashboard.");
  }

  await recordAudit({ adminUserId, action: "ADMIN_RETRIED_EMAIL", entityType: "EmailLog", entityId: emailLogId, newValue: { template: log.template, to: log.to }, ipAddress: ipAddress ?? null });
}
