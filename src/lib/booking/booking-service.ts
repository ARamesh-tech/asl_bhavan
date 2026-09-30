import "server-only";
import { Prisma, type BookingSource, type BookingStatus, type PaymentMethod, type PaymentStatus } from "@/generated/prisma/client";
import { prisma, type DbClient } from "@/lib/db/prisma";
import { getSettingsGroup } from "@/lib/settings/service";
import { NotFoundError, UnavailableError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { checkUnitAvailability, priceOverrideWhere, validateSearchRange } from "./availability-service";
import { calculatePrice, type PriceBreakdown } from "./pricing";
import { nextBookingReference } from "./sequence-service";
import { nightsBetween, type DateRange } from "./dates";
import { assertTransition, SETTLED_PAYMENT_STATUSES } from "./status";

/**
 * Booking service — every booking is created/changed here, inside a single PostgreSQL
 * transaction that:
 *
 *   1. locks the Room row (SELECT … FOR UPDATE) so concurrent requests for the same unit
 *      are serialised — this is what makes the dormitory capacity check safe;
 *   2. releases stale payment holds;
 *   3. re-checks availability from live data (never trusts the client);
 *   4. re-calculates the price from live data (never trusts the client);
 *   5. allocates the reference and inserts booking + guests (+ payment record).
 *
 * If anything fails the transaction rolls back — no partial bookings.
 * The `Booking_no_overlap_excl` DB constraint is the final guard for private rooms; a
 * violation is surfaced as UnavailableError.
 */

export type GuestInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  age?: number | null;
  address?: string | null;
  idType?: string | null;
  idReference?: string | null;
};

export type CreateBookingInput = {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  primaryGuest: { name: string; email: string; phone: string };
  additionalGuests?: GuestInput[];
  specialRequests?: string | null;
  /** Customer account, if logged in. */
  userId?: string | null;
  /**
   * ONLINE_PAYMENT → PENDING_PAYMENT with a hold timer (Razorpay)
   * OWNER_CONFIRMATION → awaiting WhatsApp/owner confirmation
   * MANUAL → created by admin (phone/walk-in); status & payment provided by admin
   */
  mode: "ONLINE_PAYMENT" | "OWNER_CONFIRMATION" | "MANUAL";
  source: BookingSource;
  /** Admin creating a manual booking. */
  createdById?: string | null;
  /** Manual-booking overrides (admin only). */
  manual?: {
    status?: Extract<BookingStatus, "CONFIRMED" | "OWNER_CONFIRMATION" | "CHECKED_IN">;
    discount?: number;
    additionalCharges?: number;
    paymentStatus?: PaymentStatus;
    paymentMethod?: PaymentMethod;
    amountReceived?: number;
    transactionId?: string | null;
    paymentNotes?: string | null;
    internalNotes?: string | null;
    /** Skip the "check-in cannot be in the past" rule (e.g. recording an ongoing stay). */
    allowPastDates?: boolean;
  };
  ipAddress?: string | null;
};

export const bookingInclude = {
  room: { select: { id: true, name: true, slug: true, type: true, category: true } },
  guests: true,
  payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const } },
  receipt: { select: { id: true, receiptNumber: true, pdfUrl: true, issuedAt: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

function isExclusionViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique violation, P2004 = constraint violation (Prisma wraps 23P01 here)
    if (err.code === "P2004") return true;
    if (err.code === "P2002") return false;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /Booking_no_overlap_excl|23P01|exclusion constraint/i.test(message);
}

export async function createBooking(input: CreateBookingInput): Promise<BookingWithRelations> {
  const range: DateRange = { start: input.checkIn, end: input.checkOut };
  const bookingSettings = await getSettingsGroup("booking");

  if (input.mode !== "MANUAL" || !input.manual?.allowPastDates) {
    validateSearchRange(input.checkIn, input.checkOut, input.guestCount, bookingSettings);
  } else if (nightsBetween(input.checkIn, input.checkOut) <= 0) {
    throw new ValidationError("Check-out must be after check-in.");
  }
  if (input.mode === "ONLINE_PAYMENT" && !bookingSettings.allowOnlinePayment) {
    throw new ValidationError("Online payment is currently disabled. Please contact the owner.");
  }
  if (input.mode === "OWNER_CONFIRMATION" && !bookingSettings.allowWhatsappBooking) {
    throw new ValidationError("Direct booking requests are currently disabled.");
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        // 1. Serialise all bookings for this unit.
        await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${input.roomId} FOR UPDATE`;

        const room = await tx.room.findFirst({
          where: { id: input.roomId, deletedAt: null },
          select: {
            id: true,
            name: true,
            type: true,
            basePrice: true,
            pricePerPerson: true,
            weekendPrice: true,
            isActive: true,
            status: true,
          },
        });
        if (!room) throw new NotFoundError("This room no longer exists.");

        // 2. Release abandoned payment holds for this unit before checking.
        await expirePendingHolds(tx, input.roomId);

        // 3. Live availability check.
        const availability = await checkUnitAvailability(tx, {
          roomId: room.id,
          range,
          guestCount: input.guestCount,
        });
        if (!availability.isAvailable) {
          throw new UnavailableError(unavailableMessage(availability.reason, room.type), {
            reason: availability.reason,
            availableUnits: availability.availableUnits,
          });
        }

        // 4. Live price calculation.
        const overrides = await tx.roomPrice.findMany({
          where: { roomId: room.id, ...priceOverrideWhere(range) },
        });
        const quote: PriceBreakdown = calculatePrice({
          room,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestCount: input.guestCount,
          overrides,
          settings: bookingSettings,
          discount: input.manual?.discount ?? 0,
          additionalCharges: input.manual?.additionalCharges ?? 0,
        });

        // 5. Status / payment derivation.
        const now = new Date();
        let status: BookingStatus;
        let paymentStatus: PaymentStatus = "PENDING";
        let holdExpiresAt: Date | null = null;
        let confirmedAt: Date | null = null;
        let amountPaid = 0;

        if (input.mode === "ONLINE_PAYMENT") {
          status = "PENDING_PAYMENT";
          holdExpiresAt = new Date(now.getTime() + bookingSettings.paymentHoldMinutes * 60_000);
        } else if (input.mode === "OWNER_CONFIRMATION") {
          status = "OWNER_CONFIRMATION";
        } else {
          status = input.manual?.status ?? "CONFIRMED";
          paymentStatus = input.manual?.paymentStatus ?? "PAY_ON_ARRIVAL";
          if (status !== "OWNER_CONFIRMATION") confirmedAt = now;
          amountPaid = Math.min(input.manual?.amountReceived ?? 0, quote.totalAmount);
          if (amountPaid > 0 && amountPaid < quote.totalAmount && paymentStatus === "PAID") {
            paymentStatus = "PARTIAL";
          }
        }

        const bookingReference = await nextBookingReference(tx, now);

        const booking = await tx.booking.create({
          data: {
            bookingReference,
            roomId: room.id,
            userId: input.userId ?? null,
            status,
            paymentStatus,
            source: input.source,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            nights: quote.nights,
            guestCount: input.guestCount,
            blocksWholeUnit: room.type === "PRIVATE_ROOM",
            guestName: input.primaryGuest.name.trim(),
            guestEmail: input.primaryGuest.email.trim().toLowerCase(),
            guestPhone: input.primaryGuest.phone.trim(),
            roomCharges: quote.roomCharges,
            additionalCharges: quote.additionalCharges,
            discount: quote.discount,
            taxRate: quote.taxRate,
            taxAmount: quote.taxAmount,
            totalAmount: quote.totalAmount,
            amountPaid,
            pricingSnapshot: quote as unknown as Prisma.InputJsonValue,
            holdExpiresAt,
            specialRequests: input.specialRequests?.trim() || null,
            internalNotes: input.manual?.internalNotes?.trim() || null,
            confirmedAt,
            confirmedById: confirmedAt ? input.createdById ?? null : null,
            createdById: input.createdById ?? null,
            guests: {
              create: [
                {
                  fullName: input.primaryGuest.name.trim(),
                  email: input.primaryGuest.email.trim().toLowerCase(),
                  phone: input.primaryGuest.phone.trim(),
                  isPrimary: true,
                },
                ...(input.additionalGuests ?? []).map((g) => ({
                  fullName: g.fullName.trim(),
                  email: g.email?.trim().toLowerCase() || null,
                  phone: g.phone?.trim() || null,
                  age: g.age ?? null,
                  address: g.address?.trim() || null,
                  idType: g.idType?.trim() || null,
                  idReference: g.idReference?.trim() || null,
                  isPrimary: false,
                })),
              ],
            },
            ...(input.mode === "MANUAL" && amountPaid > 0
              ? {
                  payments: {
                    create: {
                      amount: amountPaid,
                      method: input.manual?.paymentMethod ?? "CASH",
                      status: paymentStatus,
                      transactionId: input.manual?.transactionId?.trim() || null,
                      paidAt: now,
                      notes: input.manual?.paymentNotes?.trim() || null,
                      recordedById: input.createdById ?? null,
                    },
                  },
                }
              : {}),
          },
          include: bookingInclude,
        });

        if (input.createdById) {
          await recordAudit(
            {
              adminUserId: input.createdById,
              action: "ADMIN_CREATED_BOOKING",
              entityType: "Booking",
              entityId: booking.id,
              newValue: {
                bookingReference,
                roomId: room.id,
                checkIn: input.checkIn,
                checkOut: input.checkOut,
                guestCount: input.guestCount,
                status,
                paymentStatus,
                totalAmount: quote.totalAmount,
              },
              ipAddress: input.ipAddress ?? null,
            },
            tx,
          );
        }

        return booking;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5_000, timeout: 20_000 },
    );
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new UnavailableError();
    }
    throw err;
  }
}

function unavailableMessage(reason: string | undefined, type: "PRIVATE_ROOM" | "DORMITORY"): string {
  switch (reason) {
    case "GUESTS_EXCEED_MAXIMUM":
      return "The number of guests exceeds this room's capacity.";
    case "GUESTS_BELOW_MINIMUM":
      return "This room requires more guests than selected.";
    case "INSUFFICIENT_BEDS":
      return "Not enough dormitory beds are free for all of the selected nights.";
    case "BLOCKED":
    case "MAINTENANCE":
      return "This accommodation is unavailable for the selected dates.";
    case "INACTIVE":
      return "This accommodation is not currently offered.";
    default:
      return type === "DORMITORY"
        ? "Sorry, the dormitory is fully booked for the selected dates."
        : "Sorry, this room is already booked for the selected dates.";
  }
}

/**
 * Flip stale PENDING_PAYMENT holds to EXPIRED so inventory is released. Called inside the
 * booking transaction for the unit being booked, and periodically for all units.
 */
export async function expirePendingHolds(db: DbClient, roomId?: string, now = new Date()): Promise<number> {
  const stale = await db.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      holdExpiresAt: { lt: now },
      deletedAt: null,
      ...(roomId ? { roomId } : {}),
    },
    select: { id: true, bookingReference: true },
  });
  if (stale.length === 0) return 0;
  const ids = stale.map((b) => b.id);
  await db.booking.updateMany({
    where: { id: { in: ids }, status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED" },
  });
  await db.payment.updateMany({
    where: { bookingId: { in: ids }, status: "PENDING", deletedAt: null },
    data: { status: "FAILED", failureReason: "Payment hold expired" },
  });
  for (const b of stale) {
    await recordAudit(
      { action: "SYSTEM_EXPIRED_BOOKING", entityType: "Booking", entityId: b.id, newValue: { bookingReference: b.bookingReference } },
      db,
    );
  }
  return ids.length;
}

export async function getBookingById(id: string, db: DbClient = prisma): Promise<BookingWithRelations | null> {
  return db.booking.findFirst({ where: { id, deletedAt: null }, include: bookingInclude });
}

export async function getBookingByReference(reference: string, db: DbClient = prisma): Promise<BookingWithRelations | null> {
  return db.booking.findFirst({
    where: { bookingReference: reference.trim().toUpperCase(), deletedAt: null },
    include: bookingInclude,
  });
}

export type ConfirmBookingInput = {
  bookingId: string;
  adminUserId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountReceived?: number;
  transactionId?: string | null;
  paymentDate?: Date | null;
  notes?: string | null;
  ipAddress?: string | null;
};

/** Admin confirms an OWNER_CONFIRMATION (or revives an EXPIRED) booking with a manual payment. */
export async function confirmBookingManually(input: ConfirmBookingInput): Promise<BookingWithRelations> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: input.bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundError("Booking not found.");
    assertTransition(booking.status, "CONFIRMED");

    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${booking.roomId} FOR UPDATE`;
    const availability = await checkUnitAvailability(tx, {
      roomId: booking.roomId,
      range: { start: booking.checkIn, end: booking.checkOut },
      guestCount: booking.guestCount,
      excludeBookingId: booking.id,
    });
    if (!availability.isAvailable) {
      throw new UnavailableError("This booking can no longer be confirmed: the dates are no longer available.");
    }

    const total = booking.totalAmount.toNumber();
    const received = Math.max(0, Math.min(input.amountReceived ?? 0, total));
    let paymentStatus = input.paymentStatus;
    if (received > 0 && received < total && SETTLED_PAYMENT_STATUSES.includes(paymentStatus)) {
      paymentStatus = "PARTIAL";
    }
    const now = new Date();

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CONFIRMED",
        paymentStatus,
        amountPaid: booking.amountPaid.toNumber() + received,
        confirmedAt: now,
        confirmedById: input.adminUserId,
        holdExpiresAt: null,
        ...(received > 0 || input.transactionId
          ? {
              payments: {
                create: {
                  amount: received,
                  method: input.paymentMethod,
                  status: paymentStatus,
                  transactionId: input.transactionId?.trim() || null,
                  paidAt: input.paymentDate ?? now,
                  notes: input.notes?.trim() || null,
                  recordedById: input.adminUserId,
                },
              },
            }
          : {}),
      },
      include: bookingInclude,
    });

    await recordAudit(
      {
        adminUserId: input.adminUserId,
        action: "ADMIN_CONFIRMED_BOOKING",
        entityType: "Booking",
        entityId: booking.id,
        oldValue: { status: booking.status, paymentStatus: booking.paymentStatus },
        newValue: { status: "CONFIRMED", paymentStatus, amountReceived: received, method: input.paymentMethod },
        ipAddress: input.ipAddress ?? null,
      },
      tx,
    );
    return updated;
  });
}

export type CancelBookingInput = {
  bookingId: string;
  cancelledById: string | null;
  reason?: string | null;
  /** True when a customer (not admin) is cancelling — enforces policy cut-off. */
  byCustomer?: boolean;
  ipAddress?: string | null;
};

export async function cancelBooking(input: CancelBookingInput): Promise<BookingWithRelations> {
  const settings = await getSettingsGroup("booking");
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: input.bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundError("Booking not found.");
    assertTransition(booking.status, "CANCELLED");

    if (input.byCustomer) {
      if (!settings.allowCustomerCancellation) {
        throw new ValidationError("Online cancellation is not available. Please contact the owner.");
      }
      const cutoff = new Date(booking.checkIn.getTime() - settings.cancellationCutoffHours * 3_600_000);
      if (new Date() > cutoff) {
        throw new ValidationError(
          `Cancellations must be made at least ${settings.cancellationCutoffHours} hours before check-in. Please contact the owner.`,
        );
      }
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: input.cancelledById,
        cancellationReason: input.reason?.trim() || null,
        holdExpiresAt: null,
      },
      include: bookingInclude,
    });
    await recordAudit(
      {
        adminUserId: input.byCustomer ? null : input.cancelledById,
        action: "ADMIN_CANCELLED_BOOKING",
        entityType: "Booking",
        entityId: booking.id,
        oldValue: { status: booking.status },
        newValue: { status: "CANCELLED", reason: input.reason ?? null, byCustomer: Boolean(input.byCustomer) },
        ipAddress: input.ipAddress ?? null,
      },
      tx,
    );
    return updated;
  });
}

export async function checkInBooking(bookingId: string, adminUserId: string, ipAddress?: string | null) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundError("Booking not found.");
    assertTransition(booking.status, "CHECKED_IN");
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "CHECKED_IN", actualCheckInAt: new Date() },
      include: bookingInclude,
    });
    await recordAudit(
      { adminUserId, action: "ADMIN_CHECKED_IN", entityType: "Booking", entityId: bookingId, oldValue: { status: booking.status }, newValue: { status: "CHECKED_IN" }, ipAddress },
      tx,
    );
    return updated;
  });
}

export async function checkOutBooking(bookingId: string, adminUserId: string, ipAddress?: string | null) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundError("Booking not found.");
    assertTransition(booking.status, "CHECKED_OUT");
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "CHECKED_OUT", actualCheckOutAt: new Date() },
      include: bookingInclude,
    });
    await recordAudit(
      { adminUserId, action: "ADMIN_CHECKED_OUT", entityType: "Booking", entityId: bookingId, oldValue: { status: booking.status }, newValue: { status: "CHECKED_OUT" }, ipAddress },
      tx,
    );
    return updated;
  });
}

export async function markNoShow(bookingId: string, adminUserId: string, ipAddress?: string | null) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundError("Booking not found.");
    assertTransition(booking.status, "NO_SHOW");
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "NO_SHOW" },
      include: bookingInclude,
    });
    await recordAudit(
      { adminUserId, action: "ADMIN_MARKED_NO_SHOW", entityType: "Booking", entityId: bookingId, oldValue: { status: booking.status }, newValue: { status: "NO_SHOW" }, ipAddress },
      tx,
    );
    return updated;
  });
}

export type ModifyBookingInput = {
  bookingId: string;
  adminUserId: string;
  roomId?: string;
  checkIn?: Date;
  checkOut?: Date;
  guestCount?: number;
  discount?: number;
  additionalCharges?: number;
  specialRequests?: string | null;
  internalNotes?: string | null;
  primaryGuest?: { name?: string; email?: string; phone?: string };
  ipAddress?: string | null;
};

/**
 * Admin modification of room/dates/guests. Re-checks availability (ignoring the booking's
 * own current reservation) and re-prices with current rates. Refuses conflicting changes.
 */
export async function modifyBooking(input: ModifyBookingInput): Promise<BookingWithRelations> {
  const bookingSettings = await getSettingsGroup("booking");
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: input.bookingId, deletedAt: null } });
      if (!booking) throw new NotFoundError("Booking not found.");
      if (["CANCELLED", "EXPIRED", "CHECKED_OUT", "NO_SHOW"].includes(booking.status)) {
        throw new ValidationError(`A ${booking.status.toLowerCase().replace("_", " ")} booking cannot be modified.`);
      }

      const roomId = input.roomId ?? booking.roomId;
      const checkIn = input.checkIn ?? booking.checkIn;
      const checkOut = input.checkOut ?? booking.checkOut;
      const guestCount = input.guestCount ?? booking.guestCount;
      const range: DateRange = { start: checkIn, end: checkOut };
      if (nightsBetween(checkIn, checkOut) <= 0) throw new ValidationError("Check-out must be after check-in.");

      const inventoryChanged =
        roomId !== booking.roomId ||
        checkIn.getTime() !== booking.checkIn.getTime() ||
        checkOut.getTime() !== booking.checkOut.getTime() ||
        guestCount !== booking.guestCount;
      const priceInputsChanged =
        inventoryChanged || input.discount !== undefined || input.additionalCharges !== undefined;

      // Lock both rooms (sorted to avoid deadlocks) when moving between units.
      const lockIds = [...new Set([booking.roomId, roomId])].sort();
      for (const id of lockIds) {
        await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${id} FOR UPDATE`;
      }

      const room = await tx.room.findFirst({
        where: { id: roomId, deletedAt: null },
        select: { id: true, type: true, basePrice: true, pricePerPerson: true, weekendPrice: true },
      });
      if (!room) throw new NotFoundError("Target room not found.");

      if (inventoryChanged) {
        const availability = await checkUnitAvailability(tx, {
          roomId,
          range,
          guestCount,
          excludeBookingId: booking.id,
        });
        if (!availability.isAvailable) {
          throw new UnavailableError(unavailableMessage(availability.reason, room.type), {
            reason: availability.reason,
          });
        }
      }

      let priceData: Prisma.BookingUpdateInput = {};
      if (priceInputsChanged) {
        const overrides = await tx.roomPrice.findMany({ where: { roomId, ...priceOverrideWhere(range) } });
        const quote = calculatePrice({
          room,
          checkIn,
          checkOut,
          guestCount,
          overrides,
          settings: bookingSettings,
          discount: input.discount ?? booking.discount.toNumber(),
          additionalCharges: input.additionalCharges ?? booking.additionalCharges.toNumber(),
        });
        priceData = {
          nights: quote.nights,
          roomCharges: quote.roomCharges,
          additionalCharges: quote.additionalCharges,
          discount: quote.discount,
          taxRate: quote.taxRate,
          taxAmount: quote.taxAmount,
          totalAmount: quote.totalAmount,
          pricingSnapshot: quote as unknown as Prisma.InputJsonValue,
        };
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          room: roomId !== booking.roomId ? { connect: { id: roomId } } : undefined,
          blocksWholeUnit: room.type === "PRIVATE_ROOM",
          checkIn,
          checkOut,
          guestCount,
          ...priceData,
          specialRequests: input.specialRequests === undefined ? undefined : input.specialRequests?.trim() || null,
          internalNotes: input.internalNotes === undefined ? undefined : input.internalNotes?.trim() || null,
          guestName: input.primaryGuest?.name?.trim() || undefined,
          guestEmail: input.primaryGuest?.email?.trim().toLowerCase() || undefined,
          guestPhone: input.primaryGuest?.phone?.trim() || undefined,
        },
        include: bookingInclude,
      });

      await recordAudit(
        {
          adminUserId: input.adminUserId,
          action: "ADMIN_UPDATED_BOOKING",
          entityType: "Booking",
          entityId: booking.id,
          oldValue: {
            roomId: booking.roomId,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            guestCount: booking.guestCount,
            totalAmount: booking.totalAmount,
          },
          newValue: {
            roomId,
            checkIn,
            checkOut,
            guestCount,
            totalAmount: updated.totalAmount,
          },
          ipAddress: input.ipAddress ?? null,
        },
        tx,
      );
      return updated;
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw new UnavailableError();
    throw err;
  }
}

export type RecordPaymentInput = {
  bookingId: string;
  adminUserId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string | null;
  paymentDate?: Date | null;
  notes?: string | null;
  ipAddress?: string | null;
};

/**
 * Record an additional offline payment (e.g. balance paid in cash at check-in). Updates
 * amountPaid and derives the booking's paymentStatus from the running total.
 */
export async function recordManualPayment(input: RecordPaymentInput): Promise<BookingWithRelations> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: input.bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundError("Booking not found.");
    if (["CANCELLED", "EXPIRED"].includes(booking.status)) {
      throw new ValidationError("Payments cannot be recorded against a cancelled or expired booking.");
    }
    const total = booking.totalAmount.toNumber();
    const alreadyPaid = booking.amountPaid.toNumber();
    const amount = Math.round(input.amount * 100) / 100;
    if (amount <= 0) throw new ValidationError("Amount must be greater than zero.");
    if (alreadyPaid + amount > total + 0.005) {
      throw new ValidationError(`This would exceed the booking total. Outstanding balance is ${(total - alreadyPaid).toFixed(2)}.`);
    }
    const newPaid = alreadyPaid + amount;
    const methodStatus: Record<PaymentMethod, PaymentStatus> = {
      RAZORPAY: "PAID",
      CASH: "CASH",
      DIRECT_UPI: "DIRECT_UPI",
      BANK_TRANSFER: "BANK_TRANSFER",
      PAY_ON_ARRIVAL: "CASH",
      OTHER: "PAID",
    };
    const paymentStatus: PaymentStatus = newPaid + 0.005 >= total ? methodStatus[input.paymentMethod] : "PARTIAL";
    const now = new Date();

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        amountPaid: newPaid,
        paymentStatus,
        payments: {
          create: {
            amount,
            method: input.paymentMethod,
            status: methodStatus[input.paymentMethod],
            transactionId: input.transactionId?.trim() || null,
            paidAt: input.paymentDate ?? now,
            notes: input.notes?.trim() || null,
            recordedById: input.adminUserId,
          },
        },
      },
      include: bookingInclude,
    });
    await recordAudit(
      {
        adminUserId: input.adminUserId,
        action: "ADMIN_RECORDED_PAYMENT",
        entityType: "Booking",
        entityId: booking.id,
        oldValue: { amountPaid: alreadyPaid, paymentStatus: booking.paymentStatus },
        newValue: { amountPaid: newPaid, paymentStatus, amount, method: input.paymentMethod },
        ipAddress: input.ipAddress ?? null,
      },
      tx,
    );
    return updated;
  });
}

/** Soft delete — the row stays for audit/reporting but disappears from all lists. */
export async function softDeleteBooking(bookingId: string, adminUserId: string, ipAddress?: string | null): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundError("Booking not found.");
    if (!["CANCELLED", "EXPIRED", "NO_SHOW", "CHECKED_OUT", "DRAFT"].includes(booking.status)) {
      throw new ValidationError("Only cancelled, expired, no-show, completed or draft bookings can be deleted. Cancel it first.");
    }
    const now = new Date();
    await tx.booking.update({ where: { id: bookingId }, data: { deletedAt: now } });
    await tx.payment.updateMany({ where: { bookingId, deletedAt: null }, data: { deletedAt: now } });
    await recordAudit(
      { adminUserId, action: "ADMIN_DELETED_BOOKING", entityType: "Booking", entityId: bookingId, oldValue: { status: booking.status, bookingReference: booking.bookingReference }, ipAddress },
      tx,
    );
  });
}
