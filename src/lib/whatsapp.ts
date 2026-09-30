import { formatDateDisplay } from "@/lib/booking/dates";

/**
 * WhatsApp deep links. Only non-sensitive, guest-visible information is ever placed in
 * the URL (booking reference, dates, room name, the guest's own name/phone).
 */

export function normalizeWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Indian 10-digit numbers get the country code.
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function whatsappLink(number: string, message?: string): string {
  const n = normalizeWhatsappNumber(number);
  if (!n) return "#";
  const base = `https://wa.me/${n}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telLink(number: string): string {
  const digits = number.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits.startsWith("+") ? digits : `+${normalizeWhatsappNumber(digits)}`}` : "#";
}

export function generalEnquiryMessage(propertyName: string): string {
  return `Hello ${propertyName},\n\nI would like to know more about availability and room rates.`;
}

export function bookingRequestMessage(params: {
  propertyName: string;
  bookingReference: string;
  roomName: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  guestName: string;
  guestPhone: string;
}): string {
  return [
    `Hello ${params.propertyName},`,
    "",
    "I would like to book:",
    "",
    `Booking ID: ${params.bookingReference}`,
    "",
    `Room: ${params.roomName}`,
    `Check-in: ${formatDateDisplay(params.checkIn)}`,
    `Check-out: ${formatDateDisplay(params.checkOut)}`,
    `Guests: ${params.guestCount}`,
    "",
    `Name: ${params.guestName}`,
    `Phone: ${params.guestPhone}`,
    "",
    "Please confirm availability and payment details.",
  ].join("\n");
}

export function bookingEnquiryMessage(params: {
  propertyName: string;
  bookingReference: string;
  roomName: string;
  checkIn: Date;
  checkOut: Date;
}): string {
  return [
    `Hello ${params.propertyName},`,
    "",
    `I have a question about my booking ${params.bookingReference} (${params.roomName}, ${formatDateDisplay(params.checkIn)} – ${formatDateDisplay(params.checkOut)}).`,
  ].join("\n");
}

export function roomEnquiryMessage(params: { propertyName: string; roomName: string; checkIn?: Date; checkOut?: Date; guestCount?: number }): string {
  const lines = [`Hello ${params.propertyName},`, "", `I am interested in ${params.roomName}.`];
  if (params.checkIn && params.checkOut) {
    lines.push(`Dates: ${formatDateDisplay(params.checkIn)} – ${formatDateDisplay(params.checkOut)}`);
  }
  if (params.guestCount) lines.push(`Guests: ${params.guestCount}`);
  lines.push("", "Is it available?");
  return lines.join("\n");
}
