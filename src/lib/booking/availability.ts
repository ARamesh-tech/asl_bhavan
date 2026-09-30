import { eachNight, formatDateOnly, dateInRange, rangesOverlap, type DateRange } from "./dates";

/**
 * Pure availability calculator. Given a unit, the bookings that hold inventory, and the
 * admin blocks that touch a date range, decide how many units/beds are free on each night
 * and therefore whether a request for `guestCount` guests can be satisfied.
 *
 * - PRIVATE_ROOM: exclusive. Any overlapping booking or any block ⇒ unavailable.
 * - DORMITORY:    shared. Per night, free beds = capacity − booked guests − blocked beds.
 *                 A whole-unit block (bedsBlocked = null) removes all beds.
 *
 * The DB-backed service (availability-service.ts) fetches the inputs and calls this; the
 * booking transaction calls it again under a row lock right before inserting.
 */

export type AvailabilityRoom = {
  id: string;
  type: "PRIVATE_ROOM" | "DORMITORY";
  capacity: number;
  minGuests: number;
  maxGuests: number;
  isActive: boolean;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
};

export type AvailabilityBooking = {
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
};

export type AvailabilityBlock = {
  startDate: Date;
  endDate: Date;
  /** Dormitory only; null/undefined = whole unit blocked. */
  bedsBlocked?: number | null;
};

export type NightAvailability = {
  /** YYYY-MM-DD */
  date: string;
  /** Free units: 0/1 for private rooms; free beds for dormitory. */
  available: number;
  booked: number;
  blocked: number;
  status: "AVAILABLE" | "PARTIALLY_AVAILABLE" | "BOOKED" | "BLOCKED";
};

export type UnitAvailability = {
  roomId: string;
  /** Whether `guestCount` can be accommodated on every night of the range. */
  isAvailable: boolean;
  /** Minimum free units/beds across all nights (the bottleneck). */
  availableUnits: number;
  reason?:
    | "INACTIVE"
    | "MAINTENANCE"
    | "GUESTS_BELOW_MINIMUM"
    | "GUESTS_EXCEED_MAXIMUM"
    | "BLOCKED"
    | "BOOKED"
    | "INSUFFICIENT_BEDS"
    | "INVALID_RANGE";
  perNight: NightAvailability[];
};

export type ComputeAvailabilityInput = {
  room: AvailabilityRoom;
  range: DateRange;
  guestCount: number;
  bookings: AvailabilityBooking[];
  blocks: AvailabilityBlock[];
};

export function computeUnitAvailability(input: ComputeAvailabilityInput): UnitAvailability {
  const { room, range, guestCount } = input;
  const nights = eachNight(range.start, range.end);

  if (nights.length === 0) {
    return { roomId: room.id, isAvailable: false, availableUnits: 0, reason: "INVALID_RANGE", perNight: [] };
  }

  // Only consider records that actually overlap the requested range.
  const bookings = input.bookings.filter((b) =>
    rangesOverlap({ start: b.checkIn, end: b.checkOut }, range),
  );
  const blocks = input.blocks.filter((b) =>
    rangesOverlap({ start: b.startDate, end: b.endDate }, range),
  );

  const isDorm = room.type === "DORMITORY";
  const capacity = isDorm ? room.capacity : 1;

  const perNight: NightAvailability[] = nights.map((night) => {
    let booked = 0;
    for (const b of bookings) {
      if (dateInRange(night, { start: b.checkIn, end: b.checkOut })) {
        booked += isDorm ? b.guestCount : 1;
      }
    }
    let blocked = 0;
    for (const bl of blocks) {
      if (dateInRange(night, { start: bl.startDate, end: bl.endDate })) {
        blocked += isDorm ? (bl.bedsBlocked ?? capacity) : 1;
      }
    }
    booked = Math.min(booked, capacity);
    blocked = Math.min(blocked, capacity);
    const available = Math.max(0, capacity - booked - blocked);

    let status: NightAvailability["status"];
    if (blocked > 0 && available === 0) status = "BLOCKED";
    else if (available === 0) status = "BOOKED";
    else if (available < capacity) status = "PARTIALLY_AVAILABLE";
    else status = "AVAILABLE";

    return { date: formatDateOnly(night), available, booked, blocked, status };
  });

  const availableUnits = Math.min(...perNight.map((n) => n.available));

  const base = { roomId: room.id, availableUnits, perNight };

  if (!room.isActive || room.status === "INACTIVE") {
    return { ...base, isAvailable: false, availableUnits: 0, reason: "INACTIVE" };
  }
  if (room.status === "MAINTENANCE") {
    return { ...base, isAvailable: false, availableUnits: 0, reason: "MAINTENANCE" };
  }
  if (guestCount < room.minGuests) {
    return { ...base, isAvailable: false, reason: "GUESTS_BELOW_MINIMUM" };
  }
  if (guestCount > room.maxGuests) {
    return { ...base, isAvailable: false, reason: "GUESTS_EXCEED_MAXIMUM" };
  }

  const required = isDorm ? guestCount : 1;
  if (availableUnits < required) {
    const bottleneck = perNight.find((n) => n.available < required);
    let reason: UnitAvailability["reason"];
    if (bottleneck?.status === "BLOCKED") reason = "BLOCKED";
    else if (isDorm && availableUnits > 0) reason = "INSUFFICIENT_BEDS";
    else reason = "BOOKED";
    return { ...base, isAvailable: false, reason };
  }

  return { ...base, isAvailable: true };
}
