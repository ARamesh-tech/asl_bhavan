import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, BedDouble, HeartHandshake, MapPin, Sparkles, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { PageHero } from "@/components/layout/section";
import { AmenityIcon } from "@/components/rooms/amenity-icon";
import { Button } from "@/components/ui/button";
import { getPropertyAmenities } from "@/lib/rooms/service";
import { getSettings } from "@/lib/settings/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About" };

const ICONS: Record<string, ComponentType<LucideProps>> = { "heart-handshake": HeartHandshake, "map-pin": MapPin, "badge-check": BadgeCheck, "bed-double": BedDouble, sparkles: Sparkles };

export default async function AboutPage() {
  const [{ property, content, policies }, amenities] = await Promise.all([getSettings(), getPropertyAmenities()]);
  return (
    <>
      <PageHero eyebrow="Our story" title={content.aboutTitle} description={property.tagline} />
      <div className="container-page grid gap-12 py-12 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          <p className="whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{content.aboutText}</p>
          {content.whyChooseUs.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold">Why guests choose {property.name}</h2>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {content.whyChooseUs.map((f) => { const Icon = ICONS[f.icon] ?? Sparkles; return (
                  <li key={f.title} className="rounded-2xl border bg-card p-5 shadow-soft">
                    <Icon className="size-6 text-brand" aria-hidden />
                    <h3 className="mt-3 font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                  </li>
                ); })}
              </ul>
            </section>
          )}
          <section>
            <h2 className="text-2xl font-semibold">House rules</h2>
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{policies.houseRules}</p>
          </section>
        </div>
        <aside className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">At a glance</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Check-in</dt><dd className="font-medium">{property.checkInTime}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Check-out</dt><dd className="font-medium">{property.checkOutTime}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Location</dt><dd className="text-right font-medium">{property.city}{property.state ? `, ${property.state}` : ""}</dd></div>
            </dl>
            <Button asChild size="xl" className="mt-5 w-full"><Link href="/availability">Check availability</Link></Button>
          </div>
          {amenities.length > 0 && (
            <div className="rounded-2xl border bg-card p-6 shadow-soft">
              <h2 className="font-semibold">Amenities</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {amenities.map((a) => <li key={a.id} className="flex items-center gap-2"><AmenityIcon name={a.icon} className="size-4 text-brand" /> {a.name}</li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
