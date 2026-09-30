import { z } from "zod";
import { cuidSchema, dateOnlySchema, emailSchema, guestCountSchema, nameSchema, phoneSchema } from "./common";

export const availabilityQuerySchema = z
  .object({
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
    guests: guestCountSchema.default(1),
    roomId: cuidSchema.optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: "Check-out must be after check-in", path: ["checkOut"] });

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const additionalGuestSchema = z.object({
  fullName: nameSchema,
  age: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).max(120).optional(),
  ),
});

export const createBookingSchema = z
  .object({
    roomId: cuidSchema,
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
    guestCount: guestCountSchema,
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    specialRequests: z.string().trim().max(1000).optional().or(z.literal("")),
    additionalGuests: z.array(additionalGuestSchema).max(20).optional(),
    /** ONLINE → Razorpay; WHATSAPP → owner confirmation */
    mode: z.enum(["ONLINE", "WHATSAPP"]),
    acceptPolicies: z.literal(true, { message: "Please accept the booking policies" }),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: "Check-out must be after check-in", path: ["checkOut"] });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const bookingReferenceSchema = z.string().trim().toUpperCase().regex(/^ASL-\d{8}-[A-Z]\d{3}$/, "Invalid booking reference");
export const receiptNumberSchema = z.string().trim().toUpperCase().regex(/^ASL-RCP-\d{8}-\d{4,}$/, "Invalid receipt number");
