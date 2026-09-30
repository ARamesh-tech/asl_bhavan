import { dateInRange, eachNight, formatDateOnly, nightsBetween } from "./dates";
import { fromPaise, toPaise, type MoneyLike } from "@/lib/money";

/**
 * Pricing engine — the single source of truth for what a stay costs.
 *
 * Pure function: given the room's configured prices, any date-specific overrides, and the
 * booking settings, it produces a per-night breakdown and totals. Both the availability
 * search (quote) and booking creation (charge) call this, so the customer is always charged
 * exactly what was quoted from current database state. Client-supplied prices are ignored.
 */

export type PricingRoom = {
  type: "PRIVATE_ROOM" | "DORMITORY";
  basePrice: MoneyLike;
  pricePerPerson?: MoneyLike | null;
  weekendPrice?: MoneyLike | null;
};

export type PriceOverride = {
  startDate: Date;
  endDate: Date;
  price: MoneyLike;
  pricePerPerson?: MoneyLike | null;
  priority: number;
  reason?: string | null;
};

export type PricingSettings = {
  taxEnabled: boolean;
  /** Percentage, e.g. 12 for 12% */
  taxRate: number;
  taxLabel?: string;
  /** UTC weekday numbers (0 = Sunday … 6 = Saturday) that use weekendPrice. */
  weekendNights: number[];
};

export type NightPrice = {
  /** YYYY-MM-DD */
  date: string;
  /** Unit price for the night: per room (private) or per bed (dormitory). */
  unitPrice: number;
  /** unitPrice × units (units = 1 for private rooms, guestCount for dormitory). */
  amount: number;
  source: "BASE" | "WEEKEND" | "OVERRIDE";
  reason?: string;
};

export type PriceBreakdown = {
  nights: number;
  guestCount: number;
  /** 1 for private rooms; guestCount for dormitory beds. */
  units: number;
  perNight: NightPrice[];
  roomCharges: number;
  additionalCharges: number;
  discount: number;
  taxRate: number;
  taxLabel: string;
  taxAmount: number;
  totalAmount: number;
  averageNightlyRate: number;
};

export type CalculatePriceInput = {
  room: PricingRoom;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  overrides?: PriceOverride[];
  settings: PricingSettings;
  additionalCharges?: MoneyLike;
  discount?: MoneyLike;
};

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

function pickOverride(night: Date, overrides: PriceOverride[]): PriceOverride | undefined {
  let best: PriceOverride | undefined;
  for (const o of overrides) {
    if (!dateInRange(night, { start: o.startDate, end: o.endDate })) continue;
    if (!best || o.priority > best.priority) best = o;
  }
  return best;
}

/** Resolve the unit price (paise) for one night from override → weekend → base. */
export function resolveNightlyRate(
  night: Date,
  room: PricingRoom,
  overrides: PriceOverride[],
  settings: PricingSettings,
): Pick<NightPrice, "unitPrice" | "source" | "reason"> {
  const isDorm = room.type === "DORMITORY";
  const override = pickOverride(night, overrides);
  if (override) {
    const price = isDorm ? (override.pricePerPerson ?? override.price) : override.price;
    return {
      unitPrice: fromPaise(toPaise(price)),
      source: "OVERRIDE",
      reason: override.reason ?? undefined,
    };
  }
  const isWeekend = settings.weekendNights.includes(night.getUTCDay());
  if (isWeekend && room.weekendPrice !== null && room.weekendPrice !== undefined) {
    return { unitPrice: fromPaise(toPaise(room.weekendPrice)), source: "WEEKEND" };
  }
  const base = isDorm ? (room.pricePerPerson ?? room.basePrice) : room.basePrice;
  return { unitPrice: fromPaise(toPaise(base)), source: "BASE" };
}

export function calculatePrice(input: CalculatePriceInput): PriceBreakdown {
  const { room, checkIn, checkOut, guestCount, settings } = input;
  const overrides = input.overrides ?? [];

  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) throw new PricingError("Check-out must be after check-in.");
  if (!Number.isInteger(guestCount) || guestCount <= 0) {
    throw new PricingError("Guest count must be a positive whole number.");
  }

  const units = room.type === "DORMITORY" ? guestCount : 1;

  let roomChargesPaise = 0;
  const perNight: NightPrice[] = eachNight(checkIn, checkOut).map((night) => {
    const rate = resolveNightlyRate(night, room, overrides, settings);
    const unitPaise = toPaise(rate.unitPrice);
    const amountPaise = unitPaise * units;
    roomChargesPaise += amountPaise;
    return {
      date: formatDateOnly(night),
      unitPrice: fromPaise(unitPaise),
      amount: fromPaise(amountPaise),
      source: rate.source,
      ...(rate.reason ? { reason: rate.reason } : {}),
    };
  });

  const additionalPaise = Math.max(0, toPaise(input.additionalCharges ?? 0));
  const discountPaise = Math.min(
    Math.max(0, toPaise(input.discount ?? 0)),
    roomChargesPaise + additionalPaise,
  );

  const taxablePaise = roomChargesPaise + additionalPaise - discountPaise;
  const taxRate = settings.taxEnabled ? settings.taxRate : 0;
  const taxPaise = settings.taxEnabled ? Math.round((taxablePaise * taxRate) / 100) : 0;
  const totalPaise = taxablePaise + taxPaise;

  return {
    nights,
    guestCount,
    units,
    perNight,
    roomCharges: fromPaise(roomChargesPaise),
    additionalCharges: fromPaise(additionalPaise),
    discount: fromPaise(discountPaise),
    taxRate,
    taxLabel: settings.taxLabel ?? "Tax",
    taxAmount: fromPaise(taxPaise),
    totalAmount: fromPaise(totalPaise),
    averageNightlyRate: fromPaise(Math.round(roomChargesPaise / nights)),
  };
}
