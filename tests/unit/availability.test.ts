import { describe, expect, it } from "vitest";
import { computeUnitAvailability, type AvailabilityRoom } from "@/lib/booking/availability";
import { dateOnly as d } from "@/lib/booking/dates";

const room4: AvailabilityRoom = {
  id: "room-4",
  type: "PRIVATE_ROOM",
  capacity: 2,
  minGuests: 1,
  maxGuests: 2,
  isActive: true,
  status: "ACTIVE",
};

const dorm: AvailabilityRoom = {
  id: "dorm",
  type: "DORMITORY",
  capacity: 10,
  minGuests: 1,
  maxGuests: 10,
  isActive: true,
  status: "ACTIVE",
};

describe("private room availability", () => {
  it("is available when nothing overlaps", () => {
    const r = computeUnitAvailability({
      room: room4,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 12) },
      guestCount: 2,
      bookings: [{ checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 14), guestCount: 2 }],
      blocks: [],
    });
    expect(r.isAvailable).toBe(true);
    expect(r.availableUnits).toBe(1);
    expect(r.perNight.map((n) => n.status)).toEqual(["AVAILABLE", "AVAILABLE"]);
  });

  it("is unavailable when any booking overlaps (regardless of guest count)", () => {
    const r = computeUnitAvailability({
      room: room4,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 12) },
      guestCount: 1,
      bookings: [{ checkIn: d(2026, 10, 11), checkOut: d(2026, 10, 13), guestCount: 1 }],
      blocks: [],
    });
    expect(r.isAvailable).toBe(false);
    expect(r.reason).toBe("BOOKED");
    expect(r.perNight.map((n) => n.status)).toEqual(["AVAILABLE", "BOOKED"]);
  });

  it("admin block 10→15 Oct makes 10→12 Oct unavailable and marks nights BLOCKED", () => {
    const r = computeUnitAvailability({
      room: room4,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 12) },
      guestCount: 2,
      bookings: [],
      blocks: [{ startDate: d(2026, 10, 10), endDate: d(2026, 10, 15) }],
    });
    expect(r.isAvailable).toBe(false);
    expect(r.reason).toBe("BLOCKED");
    expect(r.perNight.every((n) => n.status === "BLOCKED")).toBe(true);
  });

  it("a block ending on the check-in date does not affect the stay", () => {
    const r = computeUnitAvailability({
      room: room4,
      range: { start: d(2026, 10, 15), end: d(2026, 10, 17) },
      guestCount: 2,
      bookings: [],
      blocks: [{ startDate: d(2026, 10, 10), endDate: d(2026, 10, 15) }],
    });
    expect(r.isAvailable).toBe(true);
  });

  it("respects capacity and minimum guests", () => {
    const tooMany = computeUnitAvailability({ room: room4, range: { start: d(2026, 10, 10), end: d(2026, 10, 11) }, guestCount: 3, bookings: [], blocks: [] });
    expect(tooMany.isAvailable).toBe(false);
    expect(tooMany.reason).toBe("GUESTS_EXCEED_MAXIMUM");

    const tooFew = computeUnitAvailability({ room: { ...room4, minGuests: 2 }, range: { start: d(2026, 10, 10), end: d(2026, 10, 11) }, guestCount: 1, bookings: [], blocks: [] });
    expect(tooFew.reason).toBe("GUESTS_BELOW_MINIMUM");
  });

  it("inactive or maintenance rooms are never available", () => {
    const inactive = computeUnitAvailability({ room: { ...room4, isActive: false }, range: { start: d(2026, 10, 10), end: d(2026, 10, 11) }, guestCount: 1, bookings: [], blocks: [] });
    expect(inactive).toMatchObject({ isAvailable: false, reason: "INACTIVE", availableUnits: 0 });
    const maint = computeUnitAvailability({ room: { ...room4, status: "MAINTENANCE" }, range: { start: d(2026, 10, 10), end: d(2026, 10, 11) }, guestCount: 1, bookings: [], blocks: [] });
    expect(maint.reason).toBe("MAINTENANCE");
  });

  it("returns INVALID_RANGE for zero-night ranges", () => {
    const r = computeUnitAvailability({ room: room4, range: { start: d(2026, 10, 10), end: d(2026, 10, 10) }, guestCount: 1, bookings: [], blocks: [] });
    expect(r.reason).toBe("INVALID_RANGE");
  });
});

describe("dormitory availability — capacity − booked guests", () => {
  it("10 beds with 4 booked leaves 6 available and is PARTIALLY_AVAILABLE, not unavailable", () => {
    const r = computeUnitAvailability({
      room: dorm,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 12) },
      guestCount: 6,
      bookings: [{ checkIn: d(2026, 10, 9), checkOut: d(2026, 10, 13), guestCount: 4 }],
      blocks: [],
    });
    expect(r.isAvailable).toBe(true);
    expect(r.availableUnits).toBe(6);
    expect(r.perNight[0]).toMatchObject({ booked: 4, available: 6, status: "PARTIALLY_AVAILABLE" });
  });

  it("rejects a request larger than the remaining beds on the tightest night", () => {
    const r = computeUnitAvailability({
      room: dorm,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 13) },
      guestCount: 5,
      bookings: [
        { checkIn: d(2026, 10, 10), checkOut: d(2026, 10, 11), guestCount: 2 }, // 8 free
        { checkIn: d(2026, 10, 11), checkOut: d(2026, 10, 12), guestCount: 7 }, // 3 free  ← bottleneck
      ],
      blocks: [],
    });
    expect(r.isAvailable).toBe(false);
    expect(r.reason).toBe("INSUFFICIENT_BEDS");
    expect(r.availableUnits).toBe(3);
    expect(r.perNight.map((n) => n.available)).toEqual([8, 3, 10]);
  });

  it("sums multiple overlapping bookings per night", () => {
    const r = computeUnitAvailability({
      room: dorm,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 11) },
      guestCount: 1,
      bookings: [
        { checkIn: d(2026, 10, 10), checkOut: d(2026, 10, 11), guestCount: 3 },
        { checkIn: d(2026, 10, 8), checkOut: d(2026, 10, 20), guestCount: 3 },
        { checkIn: d(2026, 10, 10), checkOut: d(2026, 10, 12), guestCount: 4 },
      ],
      blocks: [],
    });
    expect(r.perNight[0]).toMatchObject({ booked: 10, available: 0, status: "BOOKED" });
    expect(r.isAvailable).toBe(false);
    expect(r.reason).toBe("BOOKED");
  });

  it("partial bed blocks reduce capacity; whole-unit blocks remove all beds", () => {
    const partial = computeUnitAvailability({
      room: dorm,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 11) },
      guestCount: 7,
      bookings: [],
      blocks: [{ startDate: d(2026, 10, 10), endDate: d(2026, 10, 11), bedsBlocked: 4 }],
    });
    expect(partial.availableUnits).toBe(6);
    expect(partial.isAvailable).toBe(false);
    expect(partial.reason).toBe("INSUFFICIENT_BEDS");

    const whole = computeUnitAvailability({
      room: dorm,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 11) },
      guestCount: 1,
      bookings: [],
      blocks: [{ startDate: d(2026, 10, 10), endDate: d(2026, 10, 11), bedsBlocked: null }],
    });
    expect(whole.availableUnits).toBe(0);
    expect(whole.reason).toBe("BLOCKED");
    expect(whole.perNight[0].status).toBe("BLOCKED");
  });

  it("never reports more than capacity or negative availability", () => {
    const r = computeUnitAvailability({
      room: dorm,
      range: { start: d(2026, 10, 10), end: d(2026, 10, 11) },
      guestCount: 1,
      bookings: [{ checkIn: d(2026, 10, 10), checkOut: d(2026, 10, 11), guestCount: 25 }],
      blocks: [{ startDate: d(2026, 10, 10), endDate: d(2026, 10, 11), bedsBlocked: 50 }],
    });
    expect(r.perNight[0].available).toBe(0);
    expect(r.perNight[0].booked).toBe(10);
  });
});
