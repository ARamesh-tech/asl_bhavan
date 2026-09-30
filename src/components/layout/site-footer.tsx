import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { InstagramIcon as Instagram } from "@/components/icons/instagram";
import { getSettings } from "@/lib/settings/service";
import { publicEnv } from "@/lib/env";
import { generalEnquiryMessage, telLink, whatsappLink } from "@/lib/whatsapp";
import { BrandMark } from "./brand-mark";

export async function SiteFooter() {
  const { property, content } = await getSettings();
  const whatsapp = property.whatsappNumber || publicEnv.whatsappNumber;
  const maps = property.googleMapsUrl || publicEnv.googleMapsUrl;
  const address = [property.addressLine1, property.addressLine2, property.city, property.state, property.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <footer className="mt-auto border-t bg-sand">
      <div className="container-page grid gap-10 py-12 md:grid-cols-3">
        <div className="space-y-4">
          <BrandMark name={property.name} logoUrl={property.logoUrl} />
          <p className="max-w-sm text-sm text-muted-foreground">{property.tagline}</p>
          <div className="flex gap-2">
            {property.instagramUrl && (
              <a href={property.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid size-9 place-items-center rounded-lg border bg-card text-foreground/80 transition-colors hover:text-brand">
                <Instagram className="size-4" />
              </a>
            )}
            {whatsapp && (
              <a href={whatsappLink(whatsapp, generalEnquiryMessage(property.name))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid size-9 place-items-center rounded-lg border bg-card text-foreground/80 transition-colors hover:text-brand">
                <MessageCircle className="size-4" />
              </a>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact</h2>
          <ul className="space-y-2.5 text-sm">
            {address && (
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                {maps ? <a href={maps} target="_blank" rel="noopener noreferrer" className="hover:underline">{address}</a> : <span>{address}</span>}
              </li>
            )}
            {property.phone && (
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                <a href={telLink(property.phone)} className="hover:underline">{property.phone}</a>
              </li>
            )}
            {property.email && (
              <li className="flex gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                <a href={`mailto:${property.email}`} className="hover:underline">{property.email}</a>
              </li>
            )}
            <li className="text-muted-foreground">
              Check-in {property.checkInTime} · Check-out {property.checkOutTime}
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick links</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <li><Link href="/rooms" className="hover:underline">Rooms</Link></li>
            <li><Link href="/availability" className="hover:underline">Availability</Link></li>
            <li><Link href="/gallery" className="hover:underline">Gallery</Link></li>
            <li><Link href="/posts" className="hover:underline">Posts</Link></li>
            <li><Link href="/about" className="hover:underline">About</Link></li>
            <li><Link href="/contact" className="hover:underline">Contact</Link></li>
            <li><Link href="/policies" className="hover:underline">Policies</Link></li>
            <li><Link href="/my-bookings" className="hover:underline">My Bookings</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {property.name}. {content.footerText}</p>
          <p className="flex gap-4">
            <Link href="/policies#terms" className="hover:underline">Terms</Link>
            <Link href="/policies#privacy" className="hover:underline">Privacy</Link>
            <Link href="/policies#cancellation" className="hover:underline">Cancellation</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
