import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * Only import this module from server code (route handlers, server components,
 * services). Anything a browser needs must be prefixed NEXT_PUBLIC_ and read via
 * `publicEnv` below.
 */

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  /** Optional PEM of the database CA (Aiven "CA certificate") to enable full TLS verification. */
  DATABASE_CA_CERT: optionalString,

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  ADMIN_EMAIL: optionalString,
  ADMIN_PASSWORD: optionalString,
  ADMIN_NAME: optionalString,

  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** true = implicit TLS (port 465). false = STARTTLS upgrade (port 587, the default). */
  SMTP_SECURE: z.preprocess((v) => (v === "true" || v === "1" ? true : v === "false" || v === "0" || v === "" ? false : v), z.boolean().default(false)),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  /** Sender shown to guests, e.g. `ASL Bhavan <bookings@aslbhavan.com>`. */
  EMAIL_FROM: optionalString,
  OWNER_NOTIFICATION_EMAIL: optionalString,

  INSTAGRAM_ACCESS_TOKEN: optionalString,
  INSTAGRAM_ACCOUNT_ID: optionalString,
  CRON_SECRET: optionalString,

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_PUBLIC_URL: optionalString,
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/**
 * Lazily validated server env. Throws a readable error listing every missing/invalid
 * variable on first access, so misconfiguration fails fast at boot rather than mid-request.
 */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Values safe to ship to the browser. Next.js inlines NEXT_PUBLIC_* at build time. */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  googleMapsUrl: process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL ?? "",
} as const;

/** Feature flags derived from which integrations are configured. */
export function integrations() {
  const env = getEnv();
  return {
    razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    razorpayWebhook: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
    email: Boolean(env.SMTP_HOST && env.EMAIL_FROM),
    instagram: Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID),
    s3Storage:
      env.STORAGE_PROVIDER === "s3" &&
      Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY),
  };
}
