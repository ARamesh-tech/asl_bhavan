import "server-only";
import { prisma } from "@/lib/db/prisma";
import { bookingInclude } from "@/lib/booking/booking-service";
import { addDays, todayInTimeZone } from "@/lib/booking/dates";
import { SETTLED_PAYMENT_STATUSES } from "@/lib/booking/status";
import { sumMoney } from "@/lib/money";

export async function getDashboardData() {
  const today = todayInTimeZone();
  const tomorrow = addDays(today, 1);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const live = { deletedAt: null } as const;

  const [
    arrivals,
    departures,
    inHouse,
    pendingConfirmation,
    pendingPayment,
    rooms,
    occupiedTonight,
    monthBookings,
    recent,
    newMessages,
    upcomingWeek,
  ] = await Promise.all([
    prisma.booking.findMany({ where: { ...live, checkIn: today, status: "CONFIRMED" }, include: bookingInclude, orderBy: { createdAt: "asc" } }),
    prisma.booking.findMany({ where: { ...live, checkOut: today, status: "CHECKED_IN" }, include: bookingInclude, orderBy: { createdAt: "asc" } }),
    prisma.booking.count({ where: { ...live, status: "CHECKED_IN" } }),
    prisma.booking.findMany({ where: { ...live, status: "OWNER_CONFIRMATION" }, include: bookingInclude, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.booking.count({ where: { ...live, status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } } }),
    prisma.room.findMany({ where: { deletedAt: null, isActive: true }, select: { id: true, type: true, capacity: true } }),
    prisma.booking.findMany({
      where: { ...live, status: { in: ["CONFIRMED", "CHECKED_IN", "OWNER_CONFIRMATION", "PENDING_PAYMENT"] }, checkIn: { lte: today }, checkOut: { gt: today } },
      select: { roomId: true, guestCount: true, room: { select: { type: true } } },
    }),
    prisma.booking.findMany({
      where: { ...live, status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] }, checkIn: { gte: monthStart, lt: nextMonthStart } },
      select: { totalAmount: true, amountPaid: true, paymentStatus: true },
    }),
    prisma.booking.findMany({ where: live, include: bookingInclude, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.booking.count({ where: { ...live, status: { in: ["CONFIRMED", "OWNER_CONFIRMATION"] }, checkIn: { gt: today, lte: addDays(today, 7) } } }),
  ]);

  const privateRooms = rooms.filter((r) => r.type === "PRIVATE_ROOM");
  const dormBeds = rooms.filter((r) => r.type === "DORMITORY").reduce((s, r) => s + r.capacity, 0);
  const occupiedPrivate = new Set(occupiedTonight.filter((b) => b.room.type === "PRIVATE_ROOM").map((b) => b.roomId)).size;
  const occupiedDormBeds = occupiedTonight.filter((b) => b.room.type === "DORMITORY").reduce((s, b) => s + b.guestCount, 0);

  const monthRevenue = sumMoney(monthBookings.map((b) => b.amountPaid));
  const monthBooked = sumMoney(monthBookings.map((b) => b.totalAmount));
  const settledCount = monthBookings.filter((b) => SETTLED_PAYMENT_STATUSES.includes(b.paymentStatus)).length;

  return {
    today,
    tomorrow,
    arrivals,
    departures,
    inHouse,
    pendingConfirmation,
    pendingPayment,
    occupancy: { privateRooms: privateRooms.length, occupiedPrivate, dormBeds, occupiedDormBeds },
    month: { revenue: monthRevenue, booked: monthBooked, count: monthBookings.length, settledCount },
    recent,
    newMessages,
    upcomingWeek,
  };
}
