import { formatDateKey } from "./dates";

/**
 * Human-readable identifiers.
 *
 *   Booking reference:  ASL-YYYYMMDD-A001   (letter block + 3 digits ⇒ 26 × 999/day)
 *   Receipt number:     ASL-RCP-YYYYMMDD-0001
 *
 * Uniqueness comes from the DailySequence table (see sequence-service.ts), incremented
 * atomically inside the booking/receipt transaction, plus UNIQUE constraints on the columns.
 */

export const BOOKING_REF_PREFIX = "ASL";
export const RECEIPT_PREFIX = "ASL-RCP";

export function formatBookingReference(date: Date, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("Sequence must be a positive integer");
  }
  const block = Math.floor((sequence - 1) / 999);
  if (block > 25) throw new RangeError("Daily booking sequence exhausted");
  const letter = String.fromCharCode("A".charCodeAt(0) + block);
  const digits = String(((sequence - 1) % 999) + 1).padStart(3, "0");
  return `${BOOKING_REF_PREFIX}-${formatDateKey(date)}-${letter}${digits}`;
}

export function formatReceiptNumber(date: Date, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("Sequence must be a positive integer");
  }
  return `${RECEIPT_PREFIX}-${formatDateKey(date)}-${String(sequence).padStart(4, "0")}`;
}

export const BOOKING_REFERENCE_REGEX = /^ASL-\d{8}-[A-Z]\d{3}$/;
export const RECEIPT_NUMBER_REGEX = /^ASL-RCP-\d{8}-\d{4,}$/;

export function isBookingReference(value: string): boolean {
  return BOOKING_REFERENCE_REGEX.test(value.trim().toUpperCase());
}
