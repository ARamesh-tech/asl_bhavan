import { z } from "zod";
import { cuidSchema, dateOnlySchema, emailSchema, guestCountSchema, nameSchema, phoneSchema } from "./common";

const money = z.coerce.number().min(0).max(10_000_000);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

export const PAYMENT_METHODS = ["RAZORPAY", "CASH", "DIRECT_UPI", "BANK_TRANSFER", "PAY_ON_ARRIVAL", "OTHER"] as const;
export const MANUAL_PAYMENT_STATUS_OPTIONS = ["CASH", "DIRECT_UPI", "BANK_TRANSFER", "PAY_ON_ARRIVAL", "PARTIAL", "PAID", "PENDING"] as const;

export const confirmBookingSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(MANUAL_PAYMENT_STATUS_OPTIONS),
  amountReceived: money.optional(),
  transactionId: optionalText(100),
  paymentDate: z.string().trim().optional().or(z.literal("")),
  notes: optionalText(500),
  sendEmail: z.coerce.boolean().default(true),
});

export const recordPaymentSchema = z.object({
  amount: money.min(0.01, "Amount must be greater than zero"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  transactionId: optionalText(100),
  paymentDate: z.string().trim().optional().or(z.literal("")),
  notes: optionalText(500),
});

export const adminCancelSchema = z.object({
  reason: optionalText(500),
  sendEmail: z.coerce.boolean().default(true),
});

export const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CONFIRM") }).extend(confirmBookingSchema.shape),
  z.object({ action: z.literal("CANCEL") }).extend(adminCancelSchema.shape),
  z.object({ action: z.literal("CHECK_IN") }),
  z.object({ action: z.literal("CHECK_OUT") }),
  z.object({ action: z.literal("NO_SHOW") }),
  z.object({ action: z.literal("RECORD_PAYMENT") }).extend(recordPaymentSchema.shape),
  z.object({ action: z.literal("DELETE") }),
]);

export const modifyBookingSchema = z
  .object({
    roomId: cuidSchema.optional(),
    checkIn: dateOnlySchema.optional(),
    checkOut: dateOnlySchema.optional(),
    guestCount: guestCountSchema.optional(),
    discount: money.optional(),
    additionalCharges: money.optional(),
    specialRequests: z.string().trim().max(1000).nullable().optional(),
    internalNotes: z.string().trim().max(2000).nullable().optional(),
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((v) => !(v.checkIn && v.checkOut) || v.checkOut > v.checkIn, { message: "Check-out must be after check-in", path: ["checkOut"] });

export const manualBookingSchema = z
  .object({
    roomId: cuidSchema,
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
    guestCount: guestCountSchema,
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    source: z.enum(["MANUAL", "PHONE", "WALK_IN", "WHATSAPP"]).default("MANUAL"),
    status: z.enum(["CONFIRMED", "OWNER_CONFIRMATION", "CHECKED_IN"]).default("CONFIRMED"),
    discount: money.optional(),
    additionalCharges: money.optional(),
    paymentStatus: z.enum(MANUAL_PAYMENT_STATUS_OPTIONS).default("PENDING"),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    amountReceived: money.optional(),
    transactionId: optionalText(100),
    specialRequests: optionalText(1000),
    internalNotes: optionalText(2000),
    allowPastDates: z.coerce.boolean().default(false),
    sendEmail: z.coerce.boolean().default(false),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: "Check-out must be after check-in", path: ["checkOut"] });

export const roomBlockSchema = z
  .object({
    roomId: cuidSchema,
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    type: z.enum(["MAINTENANCE", "OWNER_USE", "PRIVATE_EVENT", "OTHER"]),
    reason: optionalText(300),
    bedsBlocked: z.coerce.number().int().min(1).max(100).optional().or(z.literal("").transform(() => undefined)),
  })
  .refine((v) => v.endDate > v.startDate, { message: "End date must be after start date", path: ["endDate"] });

export const roomPriceSchema = z
  .object({
    roomId: cuidSchema,
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    price: money.min(1),
    pricePerPerson: money.optional().or(z.literal("").transform(() => undefined)),
    priority: z.coerce.number().int().min(0).max(100).default(10),
    reason: optionalText(200),
  })
  .refine((v) => v.endDate > v.startDate, { message: "End date must be after start date", path: ["endDate"] });

export const roomUpsertSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  roomNumber: optionalText(20),
  type: z.enum(["PRIVATE_ROOM", "DORMITORY"]),
  category: z.string().trim().min(2).max(60),
  shortDescription: optionalText(200),
  description: z.string().trim().min(10).max(5000),
  capacity: z.coerce.number().int().min(1).max(100),
  minGuests: z.coerce.number().int().min(1).max(100).default(1),
  maxGuests: z.coerce.number().int().min(1).max(100),
  basePrice: money.min(1),
  pricePerPerson: money.optional().or(z.literal("").transform(() => undefined)),
  weekendPrice: money.optional().or(z.literal("").transform(() => undefined)),
  bedConfiguration: optionalText(200),
  sizeSqFt: z.coerce.number().int().min(1).max(100000).optional().or(z.literal("").transform(() => undefined)),
  floor: optionalText(40),
  rules: optionalText(2000),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).default("ACTIVE"),
  isActive: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  amenityIds: z.array(cuidSchema).max(100).default([]),
}).refine((v) => v.minGuests <= v.maxGuests && v.maxGuests <= v.capacity, { message: "Guests: min ≤ max ≤ capacity", path: ["maxGuests"] });

export const roomImageSchema = z.object({
  url: z.string().trim().url().max(2000),
  alt: optionalText(200),
  caption: optionalText(300),
  isPrimary: z.coerce.boolean().default(false),
});

export const messageStatusSchema = z.object({
  status: z.enum(["NEW", "READ", "RESOLVED"]),
  adminNotes: optionalText(2000),
});

export const userRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

export const GALLERY_CATEGORIES = ["ROOMS", "PROPERTY", "EXTERIOR", "FACILITIES", "NEARBY_ATTRACTIONS", "EVENTS"] as const;

export const postUpsertSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").optional(),
  caption: optionalText(5000),
  imageUrl: z.string().trim().url().max(2000).optional().or(z.literal("").transform(() => undefined)),
  instagramUrl: z.string().trim().url().max(500).optional().or(z.literal("").transform(() => undefined)),
  publishedAt: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  isPublished: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
});

export const postPatchSchema = z.object({
  isPublished: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  title: z.string().trim().min(2).max(160).optional(),
});

export const galleryPatchSchema = z.object({
  alt: optionalText(200),
  caption: optionalText(300),
  category: z.enum(GALLERY_CATEGORIES).optional(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const auditLogFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: optionalText(60),
  entityType: optionalText(60),
  entityId: optionalText(60),
  adminUserId: optionalText(60),
});
