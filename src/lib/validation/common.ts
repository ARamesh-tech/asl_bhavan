import { z } from "zod";
import { parseDateOnly } from "@/lib/booking/dates";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254)
  .email("Enter a valid email address")
  .transform((v) => v.toLowerCase());

/** Indian mobile numbers with optional +91/91/0 prefix, or generic international format. */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((v) => v.replace(/[\s\-().]/g, ""))
  .refine((v) => /^(\+?91|0)?[6-9]\d{9}$/.test(v) || /^\+?[1-9]\d{7,14}$/.test(v), {
    message: "Enter a valid phone number",
  });

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name is too long")
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, "Name contains invalid characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "Password must contain at least one letter and one number",
  });

/** "YYYY-MM-DD" → UTC date-only Date */
export const dateOnlySchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const d = parseDateOnly(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date (YYYY-MM-DD)" });
      return z.NEVER;
    }
    return d;
  });

export const guestCountSchema = z.coerce
  .number()
  .int("Guests must be a whole number")
  .min(1, "At least one guest is required")
  .max(50, "Too many guests");

export const cuidSchema = z.string().trim().min(10).max(40).regex(/^[a-z0-9]+$/i, "Invalid id");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z
    .union([z.literal(20), z.literal(50), z.literal(100)])
    .or(z.coerce.number().int().min(1).max(100))
    .default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginate<T>(items: T[], total: number, { page, pageSize }: Pagination) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
