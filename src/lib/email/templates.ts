/**
 * Plain, dependency-free HTML email templates. Content values are HTML-escaped.
 * Booking/receipt templates are added alongside the receipt service (Phase 11/12).
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type EmailBranding = {
  propertyName: string;
  siteUrl: string;
  supportEmail?: string;
  phone?: string;
  footerText?: string;
};

export function layout(branding: EmailBranding, title: string, bodyHtml: string): string {
  const name = escapeHtml(branding.propertyName);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f6f3ee;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1f1b16;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f3ee;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td style="background:#8b3a2f;color:#fff;padding:20px 28px;font-size:20px;font-weight:600;letter-spacing:.3px;">${name}</td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:18px 28px;background:#faf7f2;color:#6b625a;font-size:12px;line-height:1.5;border-top:1px solid #eee5da;">
          ${escapeHtml(branding.footerText ?? `Thank you for choosing ${branding.propertyName}.`)}<br>
          ${branding.phone ? `Phone: ${escapeHtml(branding.phone)} · ` : ""}${branding.supportEmail ? `Email: ${escapeHtml(branding.supportEmail)} · ` : ""}<a href="${escapeHtml(branding.siteUrl)}" style="color:#8b3a2f;">${escapeHtml(branding.siteUrl.replace(/^https?:\/\//, ""))}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#8b3a2f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export function verifyEmailTemplate(branding: EmailBranding, params: { name: string; url: string }) {
  const subject = `Verify your email – ${branding.propertyName}`;
  const html = layout(
    branding,
    subject,
    `<p>Dear ${escapeHtml(params.name)},</p>
     <p>Welcome to ${escapeHtml(branding.propertyName)}. Please confirm your email address to activate your account.</p>
     ${button(params.url, "Verify email")}
     <p style="color:#6b625a;font-size:13px;">If the button does not work, copy this link into your browser:<br>${escapeHtml(params.url)}</p>
     <p style="color:#6b625a;font-size:13px;">This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>`,
  );
  const text = `Dear ${params.name},\n\nPlease verify your email for ${branding.propertyName}: ${params.url}\n\nThis link expires in 24 hours.`;
  return { subject, html, text };
}

export type BookingEmailData = {
  bookingReference: string;
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  nights: number;
  guestCount: number;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  paymentStatusLabel: string;
  statusLabel: string;
  address: string;
  mapsUrl?: string;
  whatsappUrl?: string;
  manageUrl: string;
};

function bookingSummaryTable(d: BookingEmailData): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#6b625a;width:42%;">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eee5da;border-bottom:1px solid #eee5da;font-size:14px;">
    ${row("Booking reference", d.bookingReference)}
    ${row("Room", d.roomName)}
    ${row("Check-in", `${d.checkIn} from ${d.checkInTime}`)}
    ${row("Check-out", `${d.checkOut} by ${d.checkOutTime}`)}
    ${row("Nights", String(d.nights))}
    ${row("Guests", String(d.guestCount))}
    ${row("Total", d.totalAmount)}
    ${row("Paid", d.amountPaid)}
    ${row("Balance due", d.balanceDue)}
    ${row("Payment status", d.paymentStatusLabel)}
  </table>`;
}

function bookingSummaryText(d: BookingEmailData): string {
  return [
    `Booking reference: ${d.bookingReference}`,
    `Room: ${d.roomName}`,
    `Check-in: ${d.checkIn} from ${d.checkInTime}`,
    `Check-out: ${d.checkOut} by ${d.checkOutTime}`,
    `Nights: ${d.nights} · Guests: ${d.guestCount}`,
    `Total: ${d.totalAmount} · Paid: ${d.amountPaid} · Balance due: ${d.balanceDue}`,
    `Payment status: ${d.paymentStatusLabel}`,
  ].join("\n");
}

/** Sent when a booking request is placed via the "Contact owner" (WhatsApp) flow. */
export function bookingRequestTemplate(branding: EmailBranding, d: BookingEmailData) {
  const subject = `Booking request received – ${d.bookingReference}`;
  const html = layout(
    branding,
    subject,
    `<p>Dear ${escapeHtml(d.guestName)},</p>
     <p>We have received your booking request at ${escapeHtml(branding.propertyName)}. Your room is <strong>not confirmed yet</strong> — please contact the owner to arrange payment, after which you will receive a confirmation email.</p>
     ${bookingSummaryTable(d)}
     ${d.whatsappUrl ? button(d.whatsappUrl, "Contact owner on WhatsApp") : ""}
     <p style="color:#6b625a;font-size:13px;">You can track this booking at <a href="${escapeHtml(d.manageUrl)}" style="color:#8b3a2f;">${escapeHtml(d.manageUrl)}</a>.</p>`,
  );
  const text = `Dear ${d.guestName},\n\nWe have received your booking request at ${branding.propertyName}. It is not confirmed yet — please contact the owner to arrange payment.\n\n${bookingSummaryText(d)}\n\n${d.whatsappUrl ? `WhatsApp: ${d.whatsappUrl}\n` : ""}Track: ${d.manageUrl}`;
  return { subject, html, text };
}

/** Sent when a booking becomes CONFIRMED (online payment or owner confirmation). */
export function bookingConfirmedTemplate(branding: EmailBranding, d: BookingEmailData) {
  const subject = `Booking confirmed – ${d.bookingReference}`;
  const html = layout(
    branding,
    subject,
    `<p>Dear ${escapeHtml(d.guestName)},</p>
     <p>Your stay at ${escapeHtml(branding.propertyName)} is <strong>confirmed</strong>. We look forward to welcoming you.</p>
     ${bookingSummaryTable(d)}
     <p><strong>Address:</strong> ${escapeHtml(d.address)}${d.mapsUrl ? ` · <a href="${escapeHtml(d.mapsUrl)}" style="color:#8b3a2f;">Open in Google Maps</a>` : ""}</p>
     ${button(d.manageUrl, "View booking")}
     <p style="color:#6b625a;font-size:13px;">Please carry a valid government photo ID for all guests at check-in.</p>`,
  );
  const text = `Dear ${d.guestName},\n\nYour stay at ${branding.propertyName} is confirmed.\n\n${bookingSummaryText(d)}\n\nAddress: ${d.address}${d.mapsUrl ? `\nMap: ${d.mapsUrl}` : ""}\n\nView booking: ${d.manageUrl}`;
  return { subject, html, text };
}

export function bookingCancelledTemplate(branding: EmailBranding, d: BookingEmailData & { reason?: string | null }) {
  const subject = `Booking cancelled – ${d.bookingReference}`;
  const html = layout(
    branding,
    subject,
    `<p>Dear ${escapeHtml(d.guestName)},</p>
     <p>Your booking <strong>${escapeHtml(d.bookingReference)}</strong> at ${escapeHtml(branding.propertyName)} has been cancelled.${d.reason ? ` Reason: ${escapeHtml(d.reason)}` : ""}</p>
     ${bookingSummaryTable(d)}
     <p style="color:#6b625a;font-size:13px;">If a refund is due, the owner will process it according to the cancellation policy. Contact us if you have any questions.</p>`,
  );
  const text = `Dear ${d.guestName},\n\nYour booking ${d.bookingReference} at ${branding.propertyName} has been cancelled.${d.reason ? ` Reason: ${d.reason}` : ""}\n\n${bookingSummaryText(d)}`;
  return { subject, html, text };
}

/** Internal notification to the owner about a new booking / request. */
export function ownerNewBookingTemplate(
  branding: EmailBranding,
  d: BookingEmailData & { guestPhone: string; guestEmail: string; adminUrl: string; specialRequests?: string | null },
) {
  const subject = `New booking ${d.statusLabel.toLowerCase()} – ${d.bookingReference} (${d.roomName}, ${d.checkIn})`;
  const html = layout(
    branding,
    subject,
    `<p>A new booking has been placed on the website.</p>
     ${bookingSummaryTable(d)}
     <p><strong>Guest:</strong> ${escapeHtml(d.guestName)} · ${escapeHtml(d.guestPhone)} · ${escapeHtml(d.guestEmail)}</p>
     ${d.specialRequests ? `<p><strong>Special requests:</strong> ${escapeHtml(d.specialRequests)}</p>` : ""}
     <p><strong>Status:</strong> ${escapeHtml(d.statusLabel)}</p>
     ${button(d.adminUrl, "Open in admin")}`,
  );
  const text = `New booking (${d.statusLabel})\n\n${bookingSummaryText(d)}\n\nGuest: ${d.guestName} · ${d.guestPhone} · ${d.guestEmail}\n${d.specialRequests ? `Special requests: ${d.specialRequests}\n` : ""}\nAdmin: ${d.adminUrl}`;
  return { subject, html, text };
}

export function resetPasswordTemplate(branding: EmailBranding, params: { name: string; url: string }) {
  const subject = `Reset your password – ${branding.propertyName}`;
  const html = layout(
    branding,
    subject,
    `<p>Dear ${escapeHtml(params.name)},</p>
     <p>We received a request to reset the password for your ${escapeHtml(branding.propertyName)} account.</p>
     ${button(params.url, "Reset password")}
     <p style="color:#6b625a;font-size:13px;">If the button does not work, copy this link into your browser:<br>${escapeHtml(params.url)}</p>
     <p style="color:#6b625a;font-size:13px;">This link expires in 1 hour. If you did not request a reset, no action is needed — your password will not change.</p>`,
  );
  const text = `Dear ${params.name},\n\nReset your ${branding.propertyName} password: ${params.url}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`;
  return { subject, html, text };
}
