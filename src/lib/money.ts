/**
 * Money helpers. Amounts are handled as numbers with exactly two decimals, computed in
 * integer paise to avoid floating-point drift, and stored as DECIMAL(10,2).
 */

export type MoneyLike = number | string | { toNumber(): number };

export function toNumber(value: MoneyLike | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

/** Round to 2 decimals (half away from zero) using integer paise. */
export function roundMoney(value: number): number {
  const sign = value < 0 ? -1 : 1;
  // Adding EPSILON before scaling nudges exact halves (1.005 → 100.4999…) over the edge.
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

export function toPaise(value: MoneyLike): number {
  return Math.round(toNumber(value) * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export function sumMoney(values: MoneyLike[]): number {
  return fromPaise(values.reduce<number>((acc, v) => acc + toPaise(v), 0));
}

export function formatMoney(
  value: MoneyLike,
  currency = "INR",
  locale = "en-IN",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(toNumber(value));
}
