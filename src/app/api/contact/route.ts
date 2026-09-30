import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/service";
import { escapeHtml, layout } from "@/lib/email/templates";
import { getEnv, publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings/service";
import { contactMessageSchema } from "@/lib/validation/contact";

export const POST = handleRoute(async (req: NextRequest) => {
  const ip = clientIp(req);
  enforceRateLimit("contact", ip);
  const input = await parseBody(req, contactMessageSchema);

  const message = await prisma.contactMessage.create({
    data: { name: input.name, email: input.email, phone: input.phone || null, message: input.message, ipAddress: ip === "unknown" ? null : ip },
  });

  // Owner notification is best-effort and must not fail the request.
  void notifyOwner(message).catch((err) => logger.warn("Contact notification failed", { err }));

  return ok({ id: message.id, message: "Thank you! Your message has been received. We will get back to you soon." }, { status: 201 });
});

async function notifyOwner(m: { id: string; name: string; email: string; phone: string | null; message: string }) {
  const { property, notifications } = await getSettings();
  if (!notifications.notifyOwnerOnContactMessage) return;
  const to = notifications.ownerNotificationEmail || getEnv().OWNER_NOTIFICATION_EMAIL || property.email;
  if (!to) return;
  const subject = `New website message from ${m.name}`;
  const html = layout(
    { propertyName: property.name, siteUrl: publicEnv.siteUrl },
    subject,
    `<p><strong>${escapeHtml(m.name)}</strong> sent a message via the website contact form.</p>
     <p>Email: <a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a><br>${m.phone ? `Phone: ${escapeHtml(m.phone)}<br>` : ""}</p>
     <blockquote style="border-left:3px solid #8b3a2f;margin:16px 0;padding:8px 14px;background:#faf7f2;white-space:pre-wrap;">${escapeHtml(m.message)}</blockquote>
     <p><a href="${escapeHtml(publicEnv.siteUrl)}/admin/messages">Open in admin dashboard</a></p>`,
  );
  await sendEmail({ to, subject, html, template: "owner-contact-notification", replyTo: m.email });
}
