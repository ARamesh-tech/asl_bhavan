import { describe, expect, it } from "vitest";
import {
  addDays,
  dateOnly,
  eachNight,
  formatDateDisplay,
  formatDateKey,
  formatDateOnly,
  nightsBetween,
  parseDateOnly,
  rangesOverlap,
  toDateOnly,
} from "@/lib/booking/dates";

const d = dateOnly;

describe("date-only helpers", () => {
  it("normalises to UTC midnight", () => {
    const withTime = new Date(Date.UTC(2026, 9, 10, 17, 45, 12));
    expect(toDateOnly(withTime).toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });

  it("parses strict YYYY-MM-DD and rejects impossible dates", () => {
    expect(parseDateOnly("2026-10-05")?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("05/10/2026")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });

  it("formats keys and display strings", () => {
    expect(formatDateOnly(d(2026, 10, 5))).toBe("2026-10-05");
    expect(formatDateKey(d(2026, 10, 5))).toBe("20261005");
    expect(formatDateDisplay(d(2026, 10, 5))).toBe("05/10/2026");
  });

  it("counts nights with half-open semantics", () => {
    expect(nightsBetween(d(2026, 10, 10), d(2026, 10, 12))).toBe(2);
    expect(nightsBetween(d(2026, 10, 10), d(2026, 10, 10))).toBe(0);
    expect(nightsBetween(d(2026, 10, 12), d(2026, 10, 10))).toBe(-2);
    // across DST-irrelevant UTC boundaries and month ends
    expect(nightsBetween(d(2026, 1, 30), d(2026, 2, 2))).toBe(3);
  });

  it("enumerates each occupied night", () => {
    expect(eachNight(d(2026, 10, 10), d(2026, 10, 13)).map(formatDateOnly)).toEqual([
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
    expect(eachNight(d(2026, 10, 10), d(2026, 10, 10))).toEqual([]);
  });

  it("adds days", () => {
    expect(formatDateOnly(addDays(d(2026, 12, 31), 1))).toBe("2027-01-01");
  });
});

describe("rangesOverlap — existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn", () => {
  const existing = { start: d(2026, 10, 10), end: d(2026, 10, 15) };

  it("detects full containment and partial overlaps", () => {
    expect(rangesOverlap(existing, { start: d(2026, 10, 11), end: d(2026, 10, 12) })).toBe(true);
    expect(rangesOverlap(existing, { start: d(2026, 10, 8), end: d(2026, 10, 11) })).toBe(true);
    expect(rangesOverlap(existing, { start: d(2026, 10, 14), end: d(2026, 10, 20) })).toBe(true);
    expect(rangesOverlap(existing, { start: d(2026, 10, 1), end: d(2026, 10, 30) })).toBe(true);
  });

  it("treats back-to-back stays as NON-overlapping (check-out day = next check-in day)", () => {
    expect(rangesOverlap(existing, { start: d(2026, 10, 15), end: d(2026, 10, 18) })).toBe(false);
    expect(rangesOverlap(existing, { start: d(2026, 10, 5), end: d(2026, 10, 10) })).toBe(false);
  });

  it("is symmetric", () => {
    const other = { start: d(2026, 10, 14), end: d(2026, 10, 20) };
    expect(rangesOverlap(existing, other)).toBe(rangesOverlap(other, existing));
  });
});
