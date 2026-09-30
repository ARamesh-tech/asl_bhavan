import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm, type FieldSpec } from "@/components/admin/settings-form";
import { integrations } from "@/lib/env";
import { getSettings } from "@/lib/settings/service";

export const metadata: Metadata = { title: "Settings" };

const propertyFields: FieldSpec[] = [
  { key: "name", label: "Property name", type: "text" },
  { key: "tagline", label: "Tagline", type: "text" },
  { key: "phone", label: "Phone", type: "text", help: "Shown on the website and in emails." },
  { key: "whatsappNumber", label: "WhatsApp number", type: "text", help: "With country code, e.g. 919876543210. Used for all 'Contact owner' buttons." },
  { key: "email", label: "Contact email", type: "email" },
  { key: "checkInTime", label: "Check-in time", type: "time" },
  { key: "checkOutTime", label: "Check-out time", type: "time" },
  { key: "addressLine1", label: "Address line 1", type: "text" },
  { key: "addressLine2", label: "Address line 2", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "postalCode", label: "Postal code", type: "text" },
  { key: "country", label: "Country", type: "text" },
  { key: "googleMapsUrl", label: "Google Maps link", type: "url" },
  { key: "googleMapsEmbedUrl", label: "Google Maps embed URL", type: "url", help: "From Maps → Share → Embed a map (src attribute)." },
  { key: "instagramUrl", label: "Instagram URL", type: "url" },
  { key: "facebookUrl", label: "Facebook URL", type: "url" },
  { key: "youtubeUrl", label: "YouTube URL", type: "url" },
  { key: "logoUrl", label: "Logo image URL", type: "url" },
  { key: "currency", label: "Currency code", type: "text", help: "ISO 4217, e.g. INR" },
  { key: "currencySymbol", label: "Currency symbol", type: "text" },
];

const bookingFields: FieldSpec[] = [
  { key: "allowOnlinePayment", label: "Allow online payment (Razorpay)", type: "boolean", help: "Also requires Razorpay keys in the environment." },
  { key: "allowWhatsappBooking", label: "Allow 'Contact owner & pay directly' bookings", type: "boolean" },
  { key: "paymentHoldMinutes", label: "Payment hold (minutes)", type: "number", min: 2, max: 120, help: "How long a room is held while the guest pays online." },
  { key: "minNights", label: "Minimum nights", type: "number", min: 1 },
  { key: "maxNights", label: "Maximum nights", type: "number", min: 1 },
  { key: "maxAdvanceDays", label: "Max days in advance", type: "number", min: 1 },
  { key: "allowCustomerCancellation", label: "Guests may cancel online", type: "boolean" },
  { key: "cancellationCutoffHours", label: "Cancellation cut-off (hours before check-in)", type: "number", min: 0 },
  { key: "taxEnabled", label: "Charge tax", type: "boolean" },
  { key: "taxRate", label: "Tax rate (%)", type: "number", step: "0.01", min: 0, max: 100 },
  { key: "taxLabel", label: "Tax label", type: "text" },
  { key: "weekendNights", label: "Weekend nights (use weekend price)", type: "weekdays" },
];

const contentFields: FieldSpec[] = [
  { key: "heroTitle", label: "Hero title", type: "text" },
  { key: "heroSubtitle", label: "Hero subtitle", type: "text" },
  { key: "heroImageUrl", label: "Hero image URL", type: "url" },
  { key: "aboutTitle", label: "About title", type: "text" },
  { key: "aboutText", label: "About text", type: "textarea", rows: 6 },
  { key: "whyChooseUs", label: "Why choose us", type: "features" },
  { key: "footerText", label: "Footer text", type: "text" },
  { key: "seoDescription", label: "SEO description", type: "textarea", rows: 3 },
];

const policyFields: FieldSpec[] = [
  { key: "bookingInstructions", label: "Booking instructions", type: "textarea", rows: 3 },
  { key: "cancellationPolicy", label: "Cancellation policy", type: "textarea", rows: 4 },
  { key: "houseRules", label: "House rules", type: "textarea", rows: 4 },
  { key: "termsAndConditions", label: "Terms & conditions", type: "textarea", rows: 6 },
  { key: "privacyPolicy", label: "Privacy policy", type: "textarea", rows: 6 },
];

const notificationFields: FieldSpec[] = [
  { key: "ownerNotificationEmail", label: "Owner notification email", type: "email", help: "Falls back to OWNER_NOTIFICATION_EMAIL from the environment." },
  { key: "notifyOwnerOnNewBooking", label: "Email me on every new booking", type: "boolean" },
  { key: "notifyOwnerOnContactMessage", label: "Email me on contact messages", type: "boolean" },
  { key: "sendCustomerConfirmationEmail", label: "Email guests booking confirmations", type: "boolean" },
  { key: "autoEmailReceiptOnPayment", label: "Automatically issue and email a receipt when a booking is fully paid", type: "boolean" },
];

export default async function AdminSettingsPage() {
  const s = await getSettings();
  const flags = integrations();
  return (
    <>
      <AdminPageHeader title="Settings" description="Everything the website and booking engine reads at runtime. Changes apply on the next page load." />
      <div className="mb-6 grid gap-2 rounded-2xl border bg-card p-4 text-sm shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        <Integration name="Razorpay payments" on={flags.razorpay} hint="RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET" />
        <Integration name="Razorpay webhook" on={flags.razorpayWebhook} hint="RAZORPAY_WEBHOOK_SECRET" />
        <Integration name="Email (SMTP)" on={flags.email} hint="SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM" />
        <Integration name="Instagram sync" on={flags.instagram} hint="INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_ACCOUNT_ID" />
      </div>
      <div className="space-y-6">
        <SettingsForm group="property" title="Property" description="Contact details, address and times shown everywhere." fields={propertyFields} initial={s.property} />
        <SettingsForm group="booking" title="Booking rules" description="Controls availability search, pricing and payment options." fields={bookingFields} initial={s.booking} />
        <SettingsForm group="content" title="Website content" fields={contentFields} initial={s.content} />
        <SettingsForm group="policies" title="Policies" description="Shown on the Policies page and referenced during checkout." fields={policyFields} initial={s.policies} />
        <SettingsForm group="notifications" title="Notifications" fields={notificationFields} initial={s.notifications} />
      </div>
    </>
  );
}

function Integration({ name, on, hint }: { name: string; on: boolean; hint: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1 inline-block size-2.5 rounded-full ${on ? "bg-status-available" : "bg-muted-foreground/40"}`} aria-hidden />
      <span>
        <span className="block font-medium">{name}: {on ? "configured" : "not configured"}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </div>
  );
}
