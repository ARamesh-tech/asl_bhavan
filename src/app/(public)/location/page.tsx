import type { Metadata } from "next";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHero } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings/service";
import { generalEnquiryMessage, telLink, whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Location" };

export default async function LocationPage() {
  const { property } = await getSettings();
  const maps = property.googleMapsUrl || publicEnv.googleMapsUrl;
  const whatsapp = property.whatsappNumber || publicEnv.whatsappNumber;
  const address = [property.addressLine1, property.addressLine2, `${property.city}${property.postalCode ? ` ${property.postalCode}` : ""}`, property.state, property.country].filter(Boolean);

  return (
    <>
      <PageHero eyebrow="Getting here" title="Location" description={`${property.name} is in ${property.city}${property.state ? `, ${property.state}` : ""}.`} />
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          {property.googleMapsEmbedUrl ? (
            <iframe title={`${property.name} on Google Maps`} src={property.googleMapsEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="aspect-[4/3] w-full sm:aspect-video" />
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 bg-sand p-8 text-center sm:aspect-video">
              <MapPin className="size-10 text-brand" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">Open our location in Google Maps for directions from where you are.</p>
              {maps && <Button asChild size="xl"><a href={maps} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></Button>}
            </div>
          )}
        </div>
        <aside className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Address</h2>
            <address className="mt-3 not-italic leading-relaxed text-muted-foreground">{address.map((l) => <span key={l} className="block">{l}</span>)}</address>
            {maps && <Button asChild variant="outline" size="lg" className="mt-4 w-full"><a href={maps} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden /> Directions</a></Button>}
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Need help finding us?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Call or message the owner — we are happy to guide you.</p>
            <div className="mt-4 grid gap-2">
              {whatsapp && <Button asChild size="lg"><a href={whatsappLink(whatsapp, generalEnquiryMessage(property.name))} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden /> WhatsApp</a></Button>}
              {property.phone && <Button asChild variant="outline" size="lg"><a href={telLink(property.phone)}><Phone aria-hidden /> {property.phone}</a></Button>}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
