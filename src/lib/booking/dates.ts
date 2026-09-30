/**
 * Date-only helpers.
 *
 * Booking dates are calendar dates (no time of day). We represent them as JS Dates pinned
 * to 00:00:00 UTC — exactly what Prisma returns for `@db.Date` columns — so comparisons
 * are exact and independent of the server's timezone.
 *
 * All ranges are half-open: [start, end). A guest checking in on the 10th and out on the
 * 12th occupies the nights of the 10th and 11th; the 12th is free for the next arrival.
 */

const MS_PER_DAY = 86_400_000;

export type DateRange = { start: Date; end: Date };

/** Normalise any Date to UTC midnight (drops time-of-day). */
export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Build a UTC date-only value from Y/M/D (month is 1-based). */
export function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Parse "YYYY-MM-DD" strictly. Returns null on invalid input or impossible dates. */
export function parseDateOnly(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const [, y, mo, d] = m.map(Number) as [number, number, number, number];
  const date = dateOnly(y, mo, d);
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** "YYYY-MM-DD" */
export function formatDateOnly(d: Date): string {
  return toDateOnly(d).toISOString().slice(0, 10);
}

/** "YYYYMMDD" — used in booking references and receipt numbers. */
export function formatDateKey(d: Date): string {
  return formatDateOnly(d).replaceAll("-", "");
}

/** "DD/MM/YYYY" — Indian display format used in WhatsApp messages and receipts. */
export function formatDateDisplay(d: Date): string {
  const [y, m, day] = formatDateOnly(d).split("-");
  return `${day}/${m}/${y}`;
}

export function addDays(d: Date, days: number): Date {
  return new Date(toDateOnly(d).getTime() + days * MS_PER_DAY);
}

/** Number of nights in [checkIn, checkOut). Negative/zero means an invalid range. */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round(
    (toDateOnly(checkOut).getTime() - toDateOnly(checkIn).getTime()) / MS_PER_DAY,
  );
}

/** Every night (date) occupied by the range [checkIn, checkOut). */
export function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  const n = nightsBetween(checkIn, checkOut);
  for (let i = 0; i < n; i++) nights.push(addDays(checkIn, i));
  return nights;
}

/** Timestamp `days` days before now (server-side helper for "recent" filters). */
export function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

/** Today's calendar date in a given IANA timezone (default: property timezone, IST). */
export function todayInTimeZone(timeZone = "Asia/Kolkata", now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return dateOnly(get("year"), get("month"), get("day"));
}

/**
 * Half-open interval overlap — THE rule used everywhere (availability, booking creation,
 * admin edits, blocks, pricing overrides):
 *
 *   a.start < b.end  AND  a.end > b.start
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime();
}

/** True when `date` falls inside [range.start, range.end). */
export function dateInRange(date: Date, range: DateRange): boolean {
  const t = toDateOnly(date).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}
