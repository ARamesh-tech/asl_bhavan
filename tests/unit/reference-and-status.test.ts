import { describe, expect, it } from "vitest";
import {
  BOOKING_REFERENCE_REGEX,
  formatBookingReference,
  formatReceiptNumber,
  isBookingReference,
  RECEIPT_NUMBER_REGEX,
} from "@/lib/booking/reference";
import { dateOnly as d } from "@/lib/booking/dates";
import {
  assertTransition,
  BookingStateError,
  canTransition,
  holdsInventory,
  INVENTORY_HOLDING_STATUSES,
  isTerminal,
} from "@/lib/booking/status";
import { roundMoney, sumMoney, toPaise } from "@/lib/money";

describe("booking reference ASL-YYYYMMDD-XNNN", () => {
  it("formats the first booking of the day as A001", () => {
    expect(formatBookingReference(d(2026, 10, 5), 1)).toBe("ASL-20261005-A001");
  });

  it("rolls the letter block after 999", () => {
    expect(formatBookingReference(d(2026, 10, 5), 999)).toBe("ASL-20261005-A999");
    expect(formatBookingReference(d(2026, 10, 5), 1000)).toBe("ASL-20261005-B001");
    expect(formatBookingReference(d(2026, 10, 5), 1998)).toBe("ASL-20261005-B999");
  });

  it("produces unique values for a full day of sequences", () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 5000; i++) seen.add(formatBookingReference(d(2026, 1, 1), i));
    expect(seen.size).toBe(5000);
  });

  it("rejects invalid sequences and exhausts after 26 blocks", () => {
    expect(() => formatBookingReference(d(2026, 1, 1), 0)).toThrow(RangeError);
    expect(() => formatBookingReference(d(2026, 1, 1), 26 * 999 + 1)).toThrow(RangeError);
  });

  it("matches the public regex and validator", () => {
    const ref = formatBookingReference(d(2026, 10, 5), 42);
    expect(BOOKING_REFERENCE_REGEX.test(ref)).toBe(true);
    expect(isBookingReference(" asl-20261005-a042 ")).toBe(true);
    expect(isBookingReference("ASL-2026105-A042")).toBe(false);
    expect(isBookingReference("clx8s9d8f9")).toBe(false);
  });
});

describe("receipt number ASL-RCP-YYYYMMDD-NNNN", () => {
  it("zero-pads to four digits and grows beyond 9999", () => {
    expect(formatReceiptNumber(d(2026, 10, 5), 1)).toBe("ASL-RCP-20261005-0001");
    expect(formatReceiptNumber(d(2026, 10, 5), 12345)).toBe("ASL-RCP-20261005-12345");
    expect(RECEIPT_NUMBER_REGEX.test("ASL-RCP-20261005-0001")).toBe(true);
    expect(() => formatReceiptNumber(d(2026, 10, 5), 0)).toThrow(RangeError);
  });
});

describe("booking status transitions", () => {
  it("follows the online payment flow", () => {
    expect(canTransition("DRAFT", "PENDING_PAYMENT")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "EXPIRED")).toBe(true);
    expect(canTransition("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(canTransition("CHECKED_IN", "CHECKED_OUT")).toBe(true);
  });

  it("follows the WhatsApp/owner flow", () => {
    expect(canTransition("OWNER_CONFIRMATION", "CONFIRMED")).toBe(true);
    expect(canTransition("OWNER_CONFIRMATION", "CANCELLED")).toBe(true);
  });

  it("blocks nonsensical transitions", () => {
    expect(canTransition("CHECKED_OUT", "CONFIRMED")).toBe(false);
    expect(canTransition("CANCELLED", "CHECKED_IN")).toBe(false);
    expect(canTransition("CONFIRMED", "PENDING_PAYMENT")).toBe(false);
    expect(() => assertTransition("CANCELLED", "CONFIRMED")).toThrow(BookingStateError);
  });

  it("knows which statuses hold inventory / are terminal", () => {
    expect(INVENTORY_HOLDING_STATUSES).toEqual(["PENDING_PAYMENT", "OWNER_CONFIRMATION", "CONFIRMED", "CHECKED_IN"]);
    expect(holdsInventory("CONFIRMED")).toBe(true);
    expect(holdsInventory("CANCELLED")).toBe(false);
    expect(holdsInventory("EXPIRED")).toBe(false);
    expect(isTerminal("CHECKED_OUT")).toBe(true);
    expect(isTerminal("CHECKED_IN")).toBe(false);
  });
});

describe("money", () => {
  it("rounds half away from zero at 2 decimals and sums in paise", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(toPaise("1234.56")).toBe(123456);
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
  });
});
