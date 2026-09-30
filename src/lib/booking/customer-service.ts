import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { bookingInclude, type BookingWithRelations } from "./booking-service";
import { todayInTimeZone } from "./dates";

export type CustomerBookingScope = "upcoming" | "past" | "cancelled" | "all";

/**
 * A customer sees bookings linked to their account *or* made as a guest with the same
 * email (so bookings made before registering appear once they sign up).
 */
export function customerBookingsWhere(user: Pick<SessionUser, "id" | "email">, scope: CustomerBookingScope, today = todayInTimeZone()): Prisma.BookingWhereInput {
  const scopeWhere: Prisma.BookingWhereInput =
    scope === "upcoming"
      ? { checkOut: { gte: today }, status: { in: ["PENDING_PAYMENT", "OWNER_CONFIRMATION", "CONFIRMED", "CHECKED_IN"] } }
      : scope === "past"
        ? { OR: [{ checkOut: { lt: today } }, { status: { in: ["CHECKED_OUT", "NO_SHOW"] } }], NOT: { status: { in: ["CANCELLED", "EXPIRED"] } } }
        : scope === "cancelled"
          ? { status: { in: ["CANCELLED", "EXPIRED"] } }
          : {};
  return { deletedAt: null, OR: [{ userId: user.id }, { guestEmail: user.email }], AND: [scopeWhere] };
}

export async function listCustomerBookings(
  user: Pick<SessionUser, "id" | "email">,
  scope: CustomerBookingScope,
  page: number,
  pageSize: number,
): Promise<{ rows: BookingWithRelations[]; total: number }> {
  const where = customerBookingsWhere(user, scope);
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ checkIn: scope === "past" || scope === "cancelled" ? "desc" : "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: bookingInclude,
    }),
    prisma.booking.count({ where }),
  ]);
  return { rows, total };
}
