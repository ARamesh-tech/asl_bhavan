import { publicEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings/service";

/** schema.org LodgingBusiness structured data, fully driven by admin settings. */
export async function LodgingJsonLd() {
  const { property, content } = await getSettings();
  const sameAs = [property.instagramUrl, property.facebookUrl, property.youtubeUrl].filter(Boolean);
  const data = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: property.name,
    description: content.seoDescription,
    url: publicEnv.siteUrl,
    ...(property.logoUrl ? { logo: property.logoUrl, image: property.logoUrl } : {}),
    ...(property.phone ? { telephone: property.phone } : {}),
    ...(property.email ? { email: property.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: [property.addressLine1, property.addressLine2].filter(Boolean).join(", "),
      addressLocality: property.city,
      addressRegion: property.state,
      postalCode: property.postalCode,
      addressCountry: property.country === "India" ? "IN" : property.country,
    },
    ...(property.latitude != null && property.longitude != null
      ? { geo: { "@type": "GeoCoordinates", latitude: property.latitude, longitude: property.longitude } }
      : {}),
    ...(property.googleMapsUrl ? { hasMap: property.googleMapsUrl } : {}),
    checkinTime: property.checkInTime,
    checkoutTime: property.checkOutTime,
    priceRange: "₹₹",
    currenciesAccepted: property.currency,
    paymentAccepted: "Cash, UPI, Bank transfer, Credit card, Debit card",
    ...(sameAs.length ? { sameAs } : {}),
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be inlined; content is JSON-encoded from trusted settings only.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll("<", "\\u003c") }}
    />
  );
}
