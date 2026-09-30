import type { BookingStatus, PaymentStatus } from "@/generated/prisma/client";

/**
 * Booking lifecycle rules.
 *
 * INVENTORY_HOLDING_STATUSES are the statuses that occupy a room/beds for availability
 * purposes. They must match the WHERE clause of the `Booking_no_overlap_excl` constraint in
 * the initial migration — keep the two in sync.
 */

export const INVENTORY_HOLDING_STATUSES: readonly BookingStatus[] = [
  "PENDING_PAYMENT",
  "OWNER_CONFIRMATION",
  "CONFIRMED",
  "CHECKED_IN",
] as const;

export const TERMINAL_STATUSES: readonly BookingStatus[] = [
  "CHECKED_OUT",
  "CANCELLED",
  "EXPIRED",
  "NO_SHOW",
] as const;

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "OWNER_CONFIRMATION", "CONFIRMED", "CANCELLED", "EXPIRED"],
  PENDING_PAYMENT: ["CONFIRMED", "EXPIRED", "CANCELLED", "OWNER_CONFIRMATION"],
  OWNER_CONFIRMATION: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT", "CANCELLED"],
  CHECKED_OUT: [],
  CANCELLED: [],
  EXPIRED: ["OWNER_CONFIRMATION", "CONFIRMED"], // admin may revive an expired request if still available
  NO_SHOW: ["CHECKED_IN"], // guest turned up late after being marked no-show
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new BookingStateError(`Cannot change booking from ${from} to ${to}.`);
  }
}

export function holdsInventory(status: BookingStatus): boolean {
  return INVENTORY_HOLDING_STATUSES.includes(status);
}

export function isTerminal(status: BookingStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Statuses an admin can pick when confirming a WhatsApp/manual booking. */
export const MANUAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "CASH",
  "DIRECT_UPI",
  "BANK_TRANSFER",
  "PAY_ON_ARRIVAL",
  "PARTIAL",
  "PAID",
] as const;

/** Payment statuses that count as "money settled" for reporting. */
export const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "PAID",
  "CASH",
  "DIRECT_UPI",
  "BANK_TRANSFER",
] as const;

export class BookingStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingStateError";
  }
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Awaiting payment",
  OWNER_CONFIRMATION: "Awaiting owner confirmation",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  NO_SHOW: "No-show",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PARTIAL: "Partially paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CASH: "Paid in cash",
  DIRECT_UPI: "Paid via UPI",
  BANK_TRANSFER: "Paid by bank transfer",
  PAY_ON_ARRIVAL: "Pay on arrival",
};
