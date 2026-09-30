import "server-only";
import { sendBookingConfirmedEmail } from "@/lib/booking/notifications";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { emailReceipt, issueReceipt } from "@/lib/receipts/service";
import { getSettingsGroup } from "@/lib/settings/service";
import type { SettleResult } from "./razorpay";

/**
 * Side effects after a payment is settled (confirmation email, receipt). Never throws —
 * the money has already moved and the booking is already confirmed; failures are logged
 * and visible in the admin Emails/Receipts screens for retry.
 */
export async function afterPaymentSettled(result: SettleResult): Promise<void> {
  if (result.outcome !== "CONFIRMED") return;
  try {
    const notifications = await getSettingsGroup("notifications");
    const booking = await prisma.booking.findUnique({ where: { id: result.bookingId }, select: { status: true, paymentStatus: true, receipt: { select: { id: true } } } });
    if (!booking) return;

    if (notifications.sendCustomerConfirmationEmail) {
      await sendBookingConfirmedEmail(result.bookingId);
    }
    if (booking.paymentStatus === "PAID" && notifications.autoEmailReceiptOnPayment) {
      const receipt = booking.receipt ?? (await issueReceipt(result.bookingId, { paymentId: result.paymentId }));
      await emailReceipt(receipt.id);
    }
  } catch (err) {
    logger.error("Post-payment side effects failed", { bookingId: result.bookingId, err });
  }
}
