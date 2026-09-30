import { z } from "zod";

/**
 * Site settings are stored in the `SiteSetting` table as one JSON document per group
 * (key = group name). Each group has a Zod schema + defaults so reads are always typed
 * and missing/partial rows fall back safely. Admin → Settings edits these documents.
 *
 * Nothing here is business truth — every value is editable from the admin dashboard.
 */

export const propertySettingsSchema = z.object({
  name: z.string().min(1).default("ASL Bhavan"),
  tagline: z.string().default("Comfortable stays, warm hospitality."),
  logoUrl: z.string().default(""),
  faviconUrl: z.string().default(""),
  addressLine1: z.string().default("18/8A5 South Kundal"),
  addressLine2: z.string().default(""),
  city: z.string().default("Kanyakumari"),
  state: z.string().default("Tamil Nadu"),
  postalCode: z.string().default("629702"),
  country: z.string().default("India"),
  phone: z.string().default(""),
  whatsappNumber: z.string().default(""),
  email: z.string().default(""),
  googleMapsUrl: z.string().default("https://maps.app.goo.gl/NL45YLWuZRsR66wMA"),
  googleMapsEmbedUrl: z.string().default(""),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  instagramUrl: z.string().default("https://www.instagram.com/asl_bhavan_homestay/"),
  facebookUrl: z.string().default(""),
  youtubeUrl: z.string().default(""),
  checkInTime: z.string().default("12:00"),
  checkOutTime: z.string().default("11:00"),
  currency: z.string().length(3).default("INR"),
  currencySymbol: z.string().default("₹"),
});

export const policySettingsSchema = z.object({
  cancellationPolicy: z
    .string()
    .default(
      "Cancellation requests are handled by the property owner. Please contact us on WhatsApp for cancellations or date changes. Refunds, where applicable, are processed within 7 working days.",
    ),
  termsAndConditions: z
    .string()
    .default(
      "By booking with us you agree to respect the property, other guests and local customs. Valid government ID is required for all guests at check-in.",
    ),
  privacyPolicy: z
    .string()
    .default(
      "We collect only the information required to manage your stay. We never sell your data. Payment details are processed securely by our payment provider and are not stored on our servers.",
    ),
  houseRules: z
    .string()
    .default(
      "Non-smoking property. Quiet hours 10 PM – 7 AM. Outside guests are not permitted in rooms.",
    ),
  bookingInstructions: z
    .string()
    .default(
      "Pay online to confirm instantly, or contact the owner on WhatsApp to arrange direct payment (UPI / bank transfer / pay on arrival).",
    ),
});

export const featureItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string().default("sparkles"),
});

export const contentSettingsSchema = z.object({
  heroTitle: z.string().default("ASL Bhavan"),
  heroSubtitle: z
    .string()
    .default("A peaceful homestay minutes from the Kanyakumari shoreline."),
  heroImageUrl: z.string().default(""),
  aboutTitle: z.string().default("Welcome to ASL Bhavan"),
  aboutText: z
    .string()
    .default(
      "ASL Bhavan is a family-run homestay in Kanyakumari offering air-conditioned rooms with balconies, a shared terrace, free private parking and free Wi-Fi. Whether you are here for the sunrise at the southern tip of India or a quiet retreat, we look forward to hosting you.",
    ),
  whyChooseUs: z
    .array(featureItemSchema)
    .default([
      {
        title: "Family-run hospitality",
        description: "Hosted personally by the owners with attention to every detail.",
        icon: "heart-handshake",
      },
      {
        title: "Prime location",
        description: "Close to Kanyakumari's beaches, temples and sunrise viewpoints.",
        icon: "map-pin",
      },
      {
        title: "Instant or direct booking",
        description: "Pay online securely or arrange payment with the owner on WhatsApp.",
        icon: "badge-check",
      },
      {
        title: "Clean, comfortable rooms",
        description: "Air-conditioned rooms with balconies and free Wi-Fi.",
        icon: "bed-double",
      },
    ]),
  footerText: z
    .string()
    .default("Thank you for choosing ASL Bhavan."),
  seoDescription: z
    .string()
    .default(
      "Book your stay at ASL Bhavan, a comfortable homestay in Kanyakumari with air-conditioned rooms, a dormitory, free parking and Wi-Fi.",
    ),
});

export const bookingSettingsSchema = z.object({
  /** Minutes a PENDING_PAYMENT booking holds inventory before expiring. */
  paymentHoldMinutes: z.number().int().min(2).max(120).default(10),
  taxEnabled: z.boolean().default(false),
  /** Percentage, e.g. 12 for 12% */
  taxRate: z.number().min(0).max(100).default(0),
  taxLabel: z.string().default("GST"),
  allowOnlinePayment: z.boolean().default(true),
  allowWhatsappBooking: z.boolean().default(true),
  minNights: z.number().int().min(1).default(1),
  maxNights: z.number().int().min(1).default(30),
  /** How far in advance guests may book. */
  maxAdvanceDays: z.number().int().min(1).default(365),
  allowCustomerCancellation: z.boolean().default(true),
  /** Customers may cancel only if check-in is at least this many hours away. */
  cancellationCutoffHours: z.number().int().min(0).default(48),
  /** Nights treated as weekend for weekendPrice (0 = Sunday … 6 = Saturday). */
  weekendNights: z.array(z.number().int().min(0).max(6)).default([5, 6]),
});

export const notificationSettingsSchema = z.object({
  ownerNotificationEmail: z.string().default(""),
  notifyOwnerOnNewBooking: z.boolean().default(true),
  notifyOwnerOnContactMessage: z.boolean().default(true),
  sendCustomerConfirmationEmail: z.boolean().default(true),
  /** Issue a receipt and email it automatically when a booking becomes fully paid. */
  autoEmailReceiptOnPayment: z.boolean().default(true),
});

export const settingsSchemas = {
  property: propertySettingsSchema,
  policies: policySettingsSchema,
  content: contentSettingsSchema,
  booking: bookingSettingsSchema,
  notifications: notificationSettingsSchema,
} as const;

export type SettingsGroup = keyof typeof settingsSchemas;
export type PropertySettings = z.infer<typeof propertySettingsSchema>;
export type PolicySettings = z.infer<typeof policySettingsSchema>;
export type ContentSettings = z.infer<typeof contentSettingsSchema>;
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export type AllSettings = {
  property: PropertySettings;
  policies: PolicySettings;
  content: ContentSettings;
  booking: BookingSettings;
  notifications: NotificationSettings;
};

export const settingsGroups = Object.keys(settingsSchemas) as SettingsGroup[];

/** Parse a stored JSON document for a group, filling defaults for missing fields. */
export function parseSettingsGroup<G extends SettingsGroup>(
  group: G,
  raw: unknown,
): AllSettings[G] {
  const schema = settingsSchemas[group];
  const input = raw && typeof raw === "object" ? raw : {};
  const result = schema.safeParse(input);
  if (result.success) return result.data as AllSettings[G];
  // Corrupt/partial document: fall back to defaults rather than crashing the site.
  return schema.parse({}) as AllSettings[G];
}

export function defaultSettings(): AllSettings {
  return {
    property: propertySettingsSchema.parse({}),
    policies: policySettingsSchema.parse({}),
    content: contentSettingsSchema.parse({}),
    booking: bookingSettingsSchema.parse({}),
    notifications: notificationSettingsSchema.parse({}),
  };
}
