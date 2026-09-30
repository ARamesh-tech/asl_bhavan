import { z } from "zod";
import { emailSchema, nameSchema, phoneSchema } from "./common";

export const contactMessageSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(2000, "Message is too long"),
  /** Honeypot — must stay empty. */
  website: z.string().max(0).optional(),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
