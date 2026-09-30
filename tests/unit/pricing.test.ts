import { describe, expect, it } from "vitest";
import { calculatePrice, PricingError, type PricingSettings } from "@/lib/booking/pricing";
import { dateOnly as d } from "@/lib/booking/dates";

const noTax: PricingSettings = { taxEnabled: false, taxRate: 0, weekendNights: [5, 6] };
const privateRoom = { type: "PRIVATE_ROOM" as const, basePrice: 1800, pricePerPerson: null, weekendPrice: null };
const dorm = { type: "DORMITORY" as const, basePrice: 500, pricePerPerson: 500, weekendPrice: null };

// 2026-10-10 is a Saturday, 2026-10-11 a Sunday, 2026-10-12 a Monday
describe("calculatePrice — private room", () => {
  it("charges base price × nights", () => {
    const q = calculatePrice({ room: privateRoom, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 15), guestCount: 2, settings: noTax });
    expect(q.nights).toBe(3);
    expect(q.units).toBe(1);
    expect(q.roomCharges).toBe(5400);
    expect(q.totalAmount).toBe(5400);
    expect(q.perNight.every((n) => n.source === "BASE" && n.unitPrice === 1800)).toBe(true);
  });

  it("does not multiply private room price by guest count", () => {
    const one = calculatePrice({ room: privateRoom, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 13), guestCount: 1, settings: noTax });
    const two = calculatePrice({ room: privateRoom, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 13), guestCount: 2, settings: noTax });
    expect(one.totalAmount).toBe(two.totalAmount);
  });

  it("applies weekend price on configured nights only", () => {
    const room = { ...privateRoom, weekendPrice: 2200 };
    // Fri 9th, Sat 10th, Sun 11th nights → Fri & Sat are weekend (5, 6)
    const q = calculatePrice({ room, checkIn: d(2026, 10, 9), checkOut: d(2026, 10, 12), guestCount: 2, settings: noTax });
    expect(q.perNight.map((n) => [n.date, n.source, n.unitPrice])).toEqual([
      ["2026-10-09", "WEEKEND", 2200],
      ["2026-10-10", "WEEKEND", 2200],
      ["2026-10-11", "BASE", 1800],
    ]);
    expect(q.roomCharges).toBe(6200);
  });

  it("date overrides beat weekend and base prices, highest priority wins", () => {
    const room = { ...privateRoom, weekendPrice: 2200 };
    const overrides = [
      { startDate: d(2026, 10, 10), endDate: d(2026, 10, 11), price: 3000, priority: 0, reason: "Festival" },
      { startDate: d(2026, 10, 10), endDate: d(2026, 10, 11), price: 3500, priority: 5, reason: "Peak festival" },
    ];
    const q = calculatePrice({ room, checkIn: d(2026, 10, 9), checkOut: d(2026, 10, 12), guestCount: 2, overrides, settings: noTax });
    expect(q.perNight[1]).toMatchObject({ date: "2026-10-10", source: "OVERRIDE", unitPrice: 3500, reason: "Peak festival" });
    expect(q.perNight[0].source).toBe("WEEKEND");
    expect(q.perNight[2].source).toBe("BASE");
    expect(q.roomCharges).toBe(2200 + 3500 + 1800);
  });

  it("an override ending on check-in day does not apply (half-open range)", () => {
    const overrides = [{ startDate: d(2026, 10, 1), endDate: d(2026, 10, 12), price: 9999, priority: 0 }];
    const q = calculatePrice({ room: privateRoom, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 13), guestCount: 1, overrides, settings: noTax });
    expect(q.perNight[0].source).toBe("BASE");
  });

  it("applies discount, additional charges and tax on the taxable base", () => {
    const settings: PricingSettings = { taxEnabled: true, taxRate: 12, taxLabel: "GST", weekendNights: [] };
    const q = calculatePrice({
      room: privateRoom,
      checkIn: d(2026, 10, 12),
      checkOut: d(2026, 10, 14),
      guestCount: 2,
      settings,
      additionalCharges: 400,
      discount: 600,
    });
    // 3600 + 400 − 600 = 3400 taxable; 12% = 408
    expect(q.roomCharges).toBe(3600);
    expect(q.taxAmount).toBe(408);
    expect(q.totalAmount).toBe(3808);
    expect(q.taxLabel).toBe("GST");
  });

  it("caps discount at the chargeable amount and ignores negative inputs", () => {
    const q = calculatePrice({ room: privateRoom, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 13), guestCount: 1, settings: noTax, discount: 99999, additionalCharges: -50 });
    expect(q.discount).toBe(1800);
    expect(q.additionalCharges).toBe(0);
    expect(q.totalAmount).toBe(0);
  });

  it("handles Decimal-like inputs and fractional paise without float drift", () => {
    const room = { ...privateRoom, basePrice: { toNumber: () => 1234.56 } };
    const q = calculatePrice({ room, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 15), guestCount: 1, settings: { ...noTax, taxEnabled: true, taxRate: 18 } });
    expect(q.roomCharges).toBe(3703.68);
    expect(q.taxAmount).toBe(666.66); // 3703.68 × 0.18 = 666.6624 → 666.66
    expect(q.totalAmount).toBe(4370.34);
  });

  it("rejects invalid ranges and guest counts", () => {
    expect(() => calculatePrice({ room: privateRoom, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 12), guestCount: 1, settings: noTax })).toThrow(PricingError);
    expect(() => calculatePrice({ room: privateRoom, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 13), guestCount: 0, settings: noTax })).toThrow(PricingError);
    expect(() => calculatePrice({ room: privateRoom, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 13), guestCount: 1.5, settings: noTax })).toThrow(PricingError);
  });
});

describe("calculatePrice — dormitory", () => {
  it("charges per person per night", () => {
    const q = calculatePrice({ room: dorm, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 14), guestCount: 4, settings: noTax });
    expect(q.units).toBe(4);
    expect(q.perNight[0]).toMatchObject({ unitPrice: 500, amount: 2000 });
    expect(q.roomCharges).toBe(4000);
    expect(q.averageNightlyRate).toBe(2000);
  });

  it("uses override pricePerPerson when present, else override price", () => {
    const overrides = [
      { startDate: d(2026, 10, 12), endDate: d(2026, 10, 13), price: 900, pricePerPerson: 650, priority: 0 },
      { startDate: d(2026, 10, 13), endDate: d(2026, 10, 14), price: 700, pricePerPerson: null, priority: 0 },
    ];
    const q = calculatePrice({ room: dorm, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 14), guestCount: 2, overrides, settings: noTax });
    expect(q.perNight.map((n) => n.unitPrice)).toEqual([650, 700]);
    expect(q.roomCharges).toBe(2 * 650 + 2 * 700);
  });

  it("falls back to basePrice when pricePerPerson is null", () => {
    const q = calculatePrice({ room: { ...dorm, pricePerPerson: null, basePrice: 450 }, checkIn: d(2026, 10, 12), checkOut: d(2026, 10, 13), guestCount: 3, settings: noTax });
    expect(q.roomCharges).toBe(1350);
  });
});
