import "server-only";
import { Resend } from "resend";
import { prisma } from "@/lib/db/prisma";
import { getEnv, integrations } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Email service (Resend).
 *
 * Every send is recorded in EmailLog first, then attempted. Failures never throw to the
 * caller — a confirmed booking must never be rolled back because an email failed. Admins
 * can retry FAILED rows from the dashboard via `retryEmail`.
 */

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template: string;
  bookingId?: string | null;
  receiptId?: string | null;
  attachments?: EmailAttachment[];
  replyTo?: string;
};

export type SendEmailResult = { emailLogId: string; status: "SENT" | "FAILED"; error?: string };

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!integrations().email) return null;
  if (!client) client = new Resend(getEnv().RESEND_API_KEY);
  return client;
}

async function deliver(input: SendEmailInput): Promise<{ id: string | null; error?: string }> {
  const resend = getClient();
  if (!resend) return { id: null, error: "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL missing)." };
  const { data, error } = await resend.emails.send({
    from: getEnv().RESEND_FROM_EMAIL!,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
    attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
  });
  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const log = await prisma.emailLog.create({
    data: {
      to: input.to,
      subject: input.subject,
      template: input.template,
      status: "PENDING",
      bookingId: input.bookingId ?? null,
      receiptId: input.receiptId ?? null,
    },
  });
  return attempt(log.id, input);
}

async function attempt(emailLogId: string, input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const res = await deliver(input);
    if (res.error) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { status: "FAILED", error: res.error.slice(0, 1000), attempts: { increment: 1 }, lastAttemptAt: new Date() },
      });
      logger.warn("Email delivery failed", { emailLogId, template: input.template, error: res.error });
      return { emailLogId, status: "FAILED", error: res.error };
    }
    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: { status: "SENT", providerMessageId: res.id, attempts: { increment: 1 }, lastAttemptAt: new Date(), sentAt: new Date(), error: null },
    });
    return { emailLogId, status: "SENT" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    await prisma.emailLog
      .update({ where: { id: emailLogId }, data: { status: "FAILED", error: message.slice(0, 1000), attempts: { increment: 1 }, lastAttemptAt: new Date() } })
      .catch(() => undefined);
    logger.error("Email delivery threw", { emailLogId, err });
    return { emailLogId, status: "FAILED", error: message };
  }
}

/**
 * Retry a FAILED email. The caller re-renders the content (templates may need fresh data);
 * this just re-attempts delivery against the same log row.
 */
export async function retryEmail(emailLogId: string, input: Omit<SendEmailInput, "template">): Promise<SendEmailResult> {
  const log = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!log) throw new Error("Email log not found");
  return attempt(emailLogId, { ...input, template: log.template });
}
