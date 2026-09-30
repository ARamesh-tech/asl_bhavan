import "server-only";
import type { DbClient } from "@/lib/db/prisma";
import { formatDateKey } from "./dates";
import { formatBookingReference, formatReceiptNumber } from "./reference";

/**
 * Atomic per-day counters. The single-statement UPSERT ... RETURNING is serialised by
 * PostgreSQL row locking, so two concurrent bookings can never receive the same number,
 * and the UNIQUE constraints on Booking.bookingReference / Receipt.receiptNumber are a
 * second line of defence.
 */

export type SequenceKind = "BOOKING" | "RECEIPT";

export async function nextSequence(
  db: DbClient,
  kind: SequenceKind,
  date: Date,
): Promise<number> {
  const dateKey = formatDateKey(date);
  const rows = await db.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "DailySequence" ("kind", "dateKey", "value")
    VALUES (${kind}, ${dateKey}, 1)
    ON CONFLICT ("kind", "dateKey")
    DO UPDATE SET "value" = "DailySequence"."value" + 1
    RETURNING "value"
  `;
  const value = rows[0]?.value;
  if (typeof value !== "number") {
    throw new Error("Failed to allocate sequence number");
  }
  return value;
}

export async function nextBookingReference(db: DbClient, date = new Date()): Promise<string> {
  const seq = await nextSequence(db, "BOOKING", date);
  return formatBookingReference(date, seq);
}

export async function nextReceiptNumber(db: DbClient, date = new Date()): Promise<string> {
  const seq = await nextSequence(db, "RECEIPT", date);
  return formatReceiptNumber(date, seq);
}
