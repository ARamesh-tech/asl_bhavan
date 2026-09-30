import type { BookingStatus, PaymentStatus } from "@/generated/prisma/client";
import { BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS, SETTLED_PAYMENT_STATUSES } from "@/lib/booking/status";
import { cn } from "cn";

const bookingTone: Record<BookingStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_PAYMENT: "bg-status-partial-soft text-[oklch(0.45_0.12_75)]",
  OWNER_CONFIRMATION: "bg-status-partial-soft text-[oklch(0.45_0.12_75)]",
  CONFIRMED: "bg-status-available-soft text-status-available",
  CHECKED_IN: "bg-status-checked-in-soft text-status-checked-in",
  CHECKED_OUT: "bg-muted text-muted-foreground",
  CANCELLED: "bg-status-booked-soft text-status-booked",
  EXPIRED: "bg-muted text-muted-foreground",
  NO_SHOW: "bg-status-booked-soft text-status-booked",
};

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", bookingTone[status], className)}>
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const tone = SETTLED_PAYMENT_STATUSES.includes(status)
    ? "bg-status-available-soft text-status-available"
    : status === "FAILED"
      ? "bg-status-booked-soft text-status-booked"
      : status === "REFUNDED"
        ? "bg-muted text-muted-foreground"
        : "bg-status-partial-soft text-[oklch(0.45_0.12_75)]";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tone, className)}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
