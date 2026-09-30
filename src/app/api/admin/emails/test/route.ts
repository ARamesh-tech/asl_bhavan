import type { NextRequest } from "next/server";
import { handleRoute, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { emailBranding } from "@/lib/email/branding";
import { sendEmail, verifySmtpConnection } from "@/lib/email/service";
import { escapeHtml, layout } from "@/lib/email/templates";
import { AppError } from "@/lib/errors";

/** POST /api/admin/emails/test — verify the SMTP connection and send a test message to the admin. */
export const POST = handleRoute(async (_req: NextRequest) => {
  const admin = await requireAdmin();
  const check = await verifySmtpConnection();
  if (!check.ok) throw new AppError("INTEGRATION_DISABLED", `SMTP check failed: ${check.error ?? "unknown error"}`, 503);
  const branding = await emailBranding();
  const subject = `Test email from ${branding.propertyName}`;
  const result = await sendEmail({
    to: admin.email,
    subject,
    html: layout(branding, subject, `<p>Hello ${escapeHtml(admin.name)},</p><p>SMTP is configured correctly. Booking confirmations, owner alerts and receipts will be delivered from this address.</p>`),
    text: `Hello ${admin.name},\n\nSMTP is configured correctly.`,
    template: "smtp-test",
  });
  return ok({ to: admin.email, status: result.status, error: result.error ?? null });
});
