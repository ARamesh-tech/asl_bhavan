import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, type DbClient } from "@/lib/db/prisma";
import { getSettingsGroup } from "@/lib/settings/service";
import { ValidationError } from "@/lib/errors";
import {
  computeUnitAvailability,
  type UnitAvailability,
  type NightAvailability,
} from "./availability";
import { calculatePrice, type PriceBreakdown } from "./pricing";
import { nightsBetween, todayInTimeZone, type DateRange } from "./dates";
import { INVENTORY_HOLDING_STATUSES } from "./status";

/**
 * DB-backed availability service. Always reads live PostgreSQL state — no caching — so an
 * admin block or price change is reflected on the very next customer search.
 */

/**
 * Prisma filter for bookings that currently hold inventory and overlap `range`.
 * Stale PENDING_PAYMENT holds (past holdExpiresAt) are ignored even if the expiry job has
 * not flipped them to EXPIRED yet, so abandoned checkouts never block inventory.
 */
export function inventoryHoldingBookingWhere(
  range: DateRange,
  now = new Date(),
): Prisma.BookingWhereInput {
  return {
    deletedAt: null,
    checkIn: { lt: range.end },
    checkOut: { gt: range.start },
    OR: [
      {
        status: { in: INVENTORY_HOLDING_STATUSES.filter((s) => s !== "PENDING_PAYMENT") },
      },
      { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
      { status: "PENDING_PAYMENT", holdExpiresAt: null },
    ],
  };
}

export function blockWhere(range: DateRange): Prisma.RoomBlockWhereInput {
  return { startDate: { lt: range.end }, endDate: { gt: range.start } };
}

export function priceOverrideWhere(range: DateRange): Prisma.RoomPriceWhereInput {
  return { startDate: { lt: range.end }, endDate: { gt: range.start } };
}

const roomForAvailability = {
  id: true,
  slug: true,
  name: true,
  roomNumber: true,
  type: true,
  category: true,
  shortDescription: true,
  capacity: true,
  minGuests: true,
  maxGuests: true,
  basePrice: true,
  pricePerPerson: true,
  weekendPrice: true,
  bedConfiguration: true,
  isActive: true,
  status: true,
  isFeatured: true,
  sortOrder: true,
  images: {
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
    take: 1,
    select: { url: true, alt: true },
  },
  amenities: { select: { amenity: { select: { name: true, icon: true } } } },
} satisfies Prisma.RoomSelect;

export type AvailableRoomResult = {
  room: {
    id: string;
    slug: string;
    name: string;
    roomNumber: string | null;
    type: "PRIVATE_ROOM" | "DORMITORY";
    category: string;
    shortDescription: string | null;
    capacity: number;
    minGuests: number;
    maxGuests: number;
    bedConfiguration: string | null;
    isFeatured: boolean;
    primaryImage: { url: string; alt: string | null } | null;
    amenities: Array<{ name: string; icon: string | null }>;
  };
  availability: UnitAvailability;
  /** Null when the unit cannot accommodate the request (no quote to show). */
  quote: PriceBreakdown | null;
  restrictions: {
    minGuests: number;
    maxGuests: number;
    minNights: number;
    maxNights: number;
  };
};

export type SearchInput = {
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  /** When set, only this room is evaluated. */
  roomId?: string;
  /** Include inactive rooms (admin views). */
  includeInactive?: boolean;
};

export function validateSearchRange(
  checkIn: Date,
  checkOut: Date,
  guestCount: number,
  settings: { minNights: number; maxNights: number; maxAdvanceDays: number },
  today = todayInTimeZone(),
) {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) throw new ValidationError("Check-out must be after check-in.");
  if (checkIn < today) throw new ValidationError("Check-in date cannot be in the past.");
  if (nights < settings.minNights) {
    throw new ValidationError(`Minimum stay is ${settings.minNights} night(s).`);
  }
  if (nights > settings.maxNights) {
    throw new ValidationError(`Maximum stay is ${settings.maxNights} night(s).`);
  }
  if (nightsBetween(today, checkIn) > settings.maxAdvanceDays) {
    throw new ValidationError(
      `Bookings can be made up to ${settings.maxAdvanceDays} days in advance.`,
    );
  }
  if (!Number.isInteger(guestCount) || guestCount < 1) {
    throw new ValidationError("Please select at least one guest.");
  }
}

/**
 * getAvailableRooms(checkIn, checkOut, guests) — the public search.
 * Returns every active unit with availability + a server-calculated quote.
 */
export async function getAvailableRooms(
  input: SearchInput,
  db: DbClient = prisma,
): Promise<AvailableRoomResult[]> {
  const range: DateRange = { start: input.checkIn, end: input.checkOut };
  const bookingSettings = await getSettingsGroup("booking", db);

  const rooms = await db.room.findMany({
    where: {
      deletedAt: null,
      ...(input.roomId ? { id: input.roomId } : {}),
      ...(input.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: roomForAvailability,
  });
  if (rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r.id);
  const [bookings, blocks, overrides] = await Promise.all([
    db.booking.findMany({
      where: { roomId: { in: roomIds }, ...inventoryHoldingBookingWhere(range) },
      select: { roomId: true, checkIn: true, checkOut: true, guestCount: true },
    }),
    db.roomBlock.findMany({
      where: { roomId: { in: roomIds }, ...blockWhere(range) },
      select: { roomId: true, startDate: true, endDate: true, bedsBlocked: true },
    }),
    db.roomPrice.findMany({
      where: { roomId: { in: roomIds }, ...priceOverrideWhere(range) },
      select: {
        roomId: true,
        startDate: true,
        endDate: true,
        price: true,
        pricePerPerson: true,
        priority: true,
        reason: true,
      },
    }),
  ]);

  const groupBy = <T extends { roomId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const list = map.get(r.roomId) ?? [];
      list.push(r);
      map.set(r.roomId, list);
    }
    return map;
  };
  const bookingsByRoom = groupBy(bookings);
  const blocksByRoom = groupBy(blocks);
  const overridesByRoom = groupBy(overrides);

  return rooms.map((room) => {
    const availability = computeUnitAvailability({
      room,
      range,
      guestCount: input.guestCount,
      bookings: bookingsByRoom.get(room.id) ?? [],
      blocks: blocksByRoom.get(room.id) ?? [],
    });

    let quote: PriceBreakdown | null = null;
    if (availability.isAvailable) {
      quote = calculatePrice({
        room,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guestCount: input.guestCount,
        overrides: overridesByRoom.get(room.id) ?? [],
        settings: bookingSettings,
      });
    }

    return {
      room: {
        id: room.id,
        slug: room.slug,
        name: room.name,
        roomNumber: room.roomNumber,
        type: room.type,
        category: room.category,
        shortDescription: room.shortDescription,
        capacity: room.capacity,
        minGuests: room.minGuests,
        maxGuests: room.maxGuests,
        bedConfiguration: room.bedConfiguration,
        isFeatured: room.isFeatured,
        primaryImage: room.images[0] ?? null,
        amenities: room.amenities.map((a) => a.amenity),
      },
      availability,
      quote,
      restrictions: {
        minGuests: room.minGuests,
        maxGuests: room.maxGuests,
        minNights: bookingSettings.minNights,
        maxNights: bookingSettings.maxNights,
      },
    };
  });
}

/**
 * Availability of ONE unit for a range — used inside the booking transaction (with the
 * Room row locked) and by admin edit flows. `excludeBookingId` lets a booking being
 * modified ignore its own current dates.
 */
export async function checkUnitAvailability(
  db: DbClient,
  params: {
    roomId: string;
    range: DateRange;
    guestCount: number;
    excludeBookingId?: string;
    excludeBlockId?: string;
  },
): Promise<UnitAvailability> {
  const room = await db.room.findFirst({
    where: { id: params.roomId, deletedAt: null },
    select: {
      id: true,
      type: true,
      capacity: true,
      minGuests: true,
      maxGuests: true,
      isActive: true,
      status: true,
    },
  });
  if (!room) {
    return {
      roomId: params.roomId,
      isAvailable: false,
      availableUnits: 0,
      reason: "INACTIVE",
      perNight: [],
    };
  }
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: {
        roomId: room.id,
        ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
        ...inventoryHoldingBookingWhere(params.range),
      },
      select: { checkIn: true, checkOut: true, guestCount: true },
    }),
    db.roomBlock.findMany({
      where: {
        roomId: room.id,
        ...(params.excludeBlockId ? { id: { not: params.excludeBlockId } } : {}),
        ...blockWhere(params.range),
      },
      select: { startDate: true, endDate: true, bedsBlocked: true },
    }),
  ]);
  return computeUnitAvailability({
    room,
    range: params.range,
    guestCount: params.guestCount,
    bookings,
    blocks,
  });
}

export type CalendarCell = NightAvailability & {
  checkedIn: boolean;
  bookings: Array<{
    id: string;
    bookingReference: string;
    guestName: string;
    status: string;
    guestCount: number;
    checkIn: Date;
    checkOut: Date;
  }>;
  blocks: Array<{ id: string; type: string; reason: string | null; bedsBlocked: number | null }>;
};

export type CalendarRow = {
  room: { id: string; name: string; type: "PRIVATE_ROOM" | "DORMITORY"; capacity: number; status: string; isActive: boolean };
  cells: CalendarCell[];
};

/**
 * Occupancy grid for the admin Availability/Calendar pages: every unit × every night in
 * the range, with the bookings/blocks behind each cell so the UI can drill in.
 */
export async function getOccupancyGrid(
  range: DateRange,
  db: DbClient = prisma,
): Promise<CalendarRow[]> {
  const rooms = await db.room.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, capacity: true, minGuests: true, maxGuests: true, status: true, isActive: true },
  });
  const roomIds = rooms.map((r) => r.id);
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { roomId: { in: roomIds }, ...inventoryHoldingBookingWhere(range) },
      select: {
        id: true,
        roomId: true,
        bookingReference: true,
        guestName: true,
        status: true,
        guestCount: true,
        checkIn: true,
        checkOut: true,
      },
    }),
    db.roomBlock.findMany({
      where: { roomId: { in: roomIds }, ...blockWhere(range) },
      select: { id: true, roomId: true, startDate: true, endDate: true, type: true, reason: true, bedsBlocked: true },
    }),
  ]);

  return rooms.map((room) => {
    const roomBookings = bookings.filter((b) => b.roomId === room.id);
    const roomBlocks = blocks.filter((b) => b.roomId === room.id);
    const availability = computeUnitAvailability({
      room,
      range,
      guestCount: 1,
      bookings: roomBookings,
      blocks: roomBlocks,
    });
    const cells: CalendarCell[] = availability.perNight.map((night) => {
      const day = new Date(`${night.date}T00:00:00.000Z`).getTime();
      const dayBookings = roomBookings.filter(
        (b) => b.checkIn.getTime() <= day && b.checkOut.getTime() > day,
      );
      const dayBlocks = roomBlocks.filter(
        (b) => b.startDate.getTime() <= day && b.endDate.getTime() > day,
      );
      return {
        ...night,
        checkedIn: dayBookings.some((b) => b.status === "CHECKED_IN"),
        bookings: dayBookings.map((b) => ({
          id: b.id,
          bookingReference: b.bookingReference,
          guestName: b.guestName,
          status: b.status,
          guestCount: b.guestCount,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
        })),
        blocks: dayBlocks.map((b) => ({ id: b.id, type: b.type, reason: b.reason, bedsBlocked: b.bedsBlocked })),
      };
    });
    return {
      room: { id: room.id, name: room.name, type: room.type, capacity: room.capacity, status: room.status, isActive: room.isActive },
      cells,
    };
  });
}
