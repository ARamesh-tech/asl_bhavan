import "server-only";
import { z } from "zod";
import { eachNight, formatDateOnly, parseDateOnly, todayInTimeZone } from "@/lib/booking/dates";
import { prisma } from "@/lib/db/prisma";
import { roundMoney } from "@/lib/money";
import { toCsv } from "./bookings-service";

/**
 * Occupancy & revenue reporting.
 *
 * Occupancy is computed per night from bookings that hold inventory (CONFIRMED, CHECKED_IN,
 * CHECKED_OUT for past nights). Private rooms count 1 unit per night; the dormitory counts
 * booked beds against its capacity. Revenue is recognised per *stay night* (a booking's
 * total spread evenly across its nights) so month totals reflect stays, not payment dates.
 * Cash collected is separately summed from Payment rows by paidAt.
 */

export const reportRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  group: z.enum(["day", "month"]).optional(),
});

export type ReportRange = { from: Date; to: Date; group: "day" | "month" };

export function resolveRange(input: z.output<typeof reportRangeSchema>): ReportRange {
  const today = todayInTimeZone();
  const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  const defaultTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  let from = (input.from && parseDateOnly(input.from)) || defaultFrom;
  let to = (input.to && parseDateOnly(input.to)) || defaultTo;
  if (to <= from) [from, to] = [to, from];
  // Clamp to 2 years to keep the query bounded.
  if (to.getTime() - from.getTime() > 731 * 86_400_000) to = new Date(from.getTime() + 731 * 86_400_000);
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const group = input.group ?? (spanDays > 62 ? "month" : "day");
  return { from, to, group };
}

export type ReportBucket = {
  key: string;
  label: string;
  nights: number;
  privateUnitNights: number;
  privateAvailable: number;
  dormBedNights: number;
  dormAvailable: number;
  occupancyPct: number;
  stayRevenue: number;
  collected: number;
  bookings: number;
  cancellations: number;
};

export type ReportData = {
  range: ReportRange;
  buckets: ReportBucket[];
  totals: Omit<ReportBucket, "key" | "label">;
  byRoom: Array<{ roomId: string; name: string; type: string; unitNights: number; available: number; occupancyPct: number; revenue: number; bookings: number }>;
  bySource: Array<{ source: string; bookings: number; revenue: number }>;
  leadTimeDays: number | null;
  avgStayNights: number | null;
};

function bucketKey(d: Date, group: "day" | "month"): string {
  return group === "day" ? formatDateOnly(d) : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketLabel(key: string, group: "day" | "month"): string {
  if (group === "day") {
    const [y, m, d] = key.split("-");
    return `${d}/${m}/${y}`;
  }
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function getReportData(range: ReportRange): Promise<ReportData> {
  const { from, to, group } = range;
  const [rooms, bookings, payments, cancelled] = await Promise.all([
    prisma.room.findMany({ where: { deletedAt: null }, select: { id: true, name: true, type: true, capacity: true, isActive: true } }),
    prisma.booking.findMany({
      where: { deletedAt: null, status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] }, checkIn: { lt: to }, checkOut: { gt: from } },
      select: { id: true, roomId: true, checkIn: true, checkOut: true, nights: true, guestCount: true, totalAmount: true, source: true, createdAt: true, room: { select: { type: true } } },
    }),
    prisma.payment.findMany({
      where: { deletedAt: null, paidAt: { gte: from, lt: to }, status: { in: ["PAID", "CASH", "DIRECT_UPI", "BANK_TRANSFER", "PARTIAL", "REFUNDED"] } },
      select: { amount: true, refundedAmount: true, paidAt: true },
    }),
    prisma.booking.findMany({ where: { deletedAt: null, status: { in: ["CANCELLED", "NO_SHOW"] }, checkIn: { gte: from, lt: to } }, select: { checkIn: true } }),
  ]);

  const privateRooms = rooms.filter((r) => r.type === "PRIVATE_ROOM" && r.isActive).length;
  const dormBeds = rooms.filter((r) => r.type === "DORMITORY" && r.isActive).reduce((a, r) => a + r.capacity, 0);

  const buckets = new Map<string, ReportBucket>();
  const ensure = (key: string) => {
    let b = buckets.get(key);
    if (!b) {
      b = { key, label: bucketLabel(key, group), nights: 0, privateUnitNights: 0, privateAvailable: 0, dormBedNights: 0, dormAvailable: 0, occupancyPct: 0, stayRevenue: 0, collected: 0, bookings: 0, cancellations: 0 };
      buckets.set(key, b);
    }
    return b;
  };

  // Available inventory per night in range.
  for (const night of eachNight(from, to)) {
    const b = ensure(bucketKey(night, group));
    b.nights += 1;
    b.privateAvailable += privateRooms;
    b.dormAvailable += dormBeds;
  }

  const byRoom = new Map<string, { unitNights: number; revenue: number; bookings: Set<string> }>();
  const bySource = new Map<string, { bookings: number; revenue: number }>();
  let leadSum = 0;
  let staySum = 0;

  for (const bk of bookings) {
    const perNight = bk.nights > 0 ? bk.totalAmount.toNumber() / bk.nights : 0;
    const counted = new Set<string>();
    for (const night of eachNight(bk.checkIn, bk.checkOut)) {
      if (night < from || night >= to) continue;
      const key = bucketKey(night, group);
      const b = ensure(key);
      if (bk.room.type === "DORMITORY") b.dormBedNights += bk.guestCount;
      else b.privateUnitNights += 1;
      b.stayRevenue += perNight;
      if (!counted.has(key)) {
        b.bookings += 1;
        counted.add(key);
      }
      const r = byRoom.get(bk.roomId) ?? { unitNights: 0, revenue: 0, bookings: new Set<string>() };
      r.unitNights += bk.room.type === "DORMITORY" ? bk.guestCount : 1;
      r.revenue += perNight;
      r.bookings.add(bk.id);
      byRoom.set(bk.roomId, r);
    }
    const s = bySource.get(bk.source) ?? { bookings: 0, revenue: 0 };
    s.bookings += 1;
    s.revenue += bk.totalAmount.toNumber();
    bySource.set(bk.source, s);
    leadSum += Math.max(0, (bk.checkIn.getTime() - bk.createdAt.getTime()) / 86_400_000);
    staySum += bk.nights;
  }

  for (const p of payments) {
    if (!p.paidAt) continue;
    const key = bucketKey(new Date(Date.UTC(p.paidAt.getUTCFullYear(), p.paidAt.getUTCMonth(), p.paidAt.getUTCDate())), group);
    ensure(key).collected += p.amount.toNumber() - p.refundedAmount.toNumber();
  }
  for (const c of cancelled) ensure(bucketKey(c.checkIn, group)).cancellations += 1;

  const list = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const b of list) {
    const avail = b.privateAvailable + b.dormAvailable;
    b.occupancyPct = avail > 0 ? Math.round(((b.privateUnitNights + b.dormBedNights) / avail) * 1000) / 10 : 0;
    b.stayRevenue = roundMoney(b.stayRevenue);
    b.collected = roundMoney(b.collected);
  }

  const totals = list.reduce(
    (t, b) => ({
      nights: t.nights + b.nights,
      privateUnitNights: t.privateUnitNights + b.privateUnitNights,
      privateAvailable: t.privateAvailable + b.privateAvailable,
      dormBedNights: t.dormBedNights + b.dormBedNights,
      dormAvailable: t.dormAvailable + b.dormAvailable,
      occupancyPct: 0,
      stayRevenue: roundMoney(t.stayRevenue + b.stayRevenue),
      collected: roundMoney(t.collected + b.collected),
      bookings: t.bookings + b.bookings,
      cancellations: t.cancellations + b.cancellations,
    }),
    { nights: 0, privateUnitNights: 0, privateAvailable: 0, dormBedNights: 0, dormAvailable: 0, occupancyPct: 0, stayRevenue: 0, collected: 0, bookings: 0, cancellations: 0 },
  );
  totals.bookings = bookings.length;
  const totalAvail = totals.privateAvailable + totals.dormAvailable;
  totals.occupancyPct = totalAvail > 0 ? Math.round(((totals.privateUnitNights + totals.dormBedNights) / totalAvail) * 1000) / 10 : 0;

  const nightsInRange = totals.nights;
  return {
    range,
    buckets: list,
    totals,
    byRoom: rooms
      .map((r) => {
        const agg = byRoom.get(r.id);
        const available = nightsInRange * (r.type === "DORMITORY" ? r.capacity : 1);
        const unitNights = agg?.unitNights ?? 0;
        return { roomId: r.id, name: r.name, type: r.type, unitNights, available, occupancyPct: available > 0 ? Math.round((unitNights / available) * 1000) / 10 : 0, revenue: roundMoney(agg?.revenue ?? 0), bookings: agg?.bookings.size ?? 0 };
      })
      .sort((a, b) => b.revenue - a.revenue),
    bySource: [...bySource.entries()].map(([source, v]) => ({ source, bookings: v.bookings, revenue: roundMoney(v.revenue) })).sort((a, b) => b.revenue - a.revenue),
    leadTimeDays: bookings.length ? Math.round((leadSum / bookings.length) * 10) / 10 : null,
    avgStayNights: bookings.length ? Math.round((staySum / bookings.length) * 10) / 10 : null,
  };
}

export function reportCsv(data: ReportData): string {
  const header = ["Period", "Nights", "Private room-nights sold", "Private room-nights available", "Dorm bed-nights sold", "Dorm bed-nights available", "Occupancy %", "Stay revenue", "Collected (net of refunds)", "Bookings", "Cancellations/No-shows"];
  const rows = data.buckets.map((b) => [b.label, b.nights, b.privateUnitNights, b.privateAvailable, b.dormBedNights, b.dormAvailable, b.occupancyPct, b.stayRevenue.toFixed(2), b.collected.toFixed(2), b.bookings, b.cancellations]);
  rows.push(["TOTAL", data.totals.nights, data.totals.privateUnitNights, data.totals.privateAvailable, data.totals.dormBedNights, data.totals.dormAvailable, data.totals.occupancyPct, data.totals.stayRevenue.toFixed(2), data.totals.collected.toFixed(2), data.totals.bookings, data.totals.cancellations]);
  return toCsv([header, ...rows]);
}
