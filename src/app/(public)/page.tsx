import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BedDouble, HeartHandshake, MapPin, MessageCircle, Phone, Sparkles, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { SearchWidget } from "@/components/booking/search-widget";
import { AmenityIcon } from "@/components/rooms/amenity-icon";
import { RoomCard } from "@/components/rooms/room-card";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { getPropertyAmenities, getPublicRooms } from "@/lib/rooms/service";
import { getSettings } from "@/lib/settings/service";
import { generalEnquiryMessage, telLink, whatsappLink } from "@/lib/whatsapp";
import { GalleryStrip } from "@/components/gallery/gallery-strip";
import { PostCard } from "@/components/posts/post-card";
import { LodgingJsonLd } from "@/components/seo/lodging-json-ld";
import { EmptyNote, SectionHeading } from "@/components/layout/section";

export const dynamic = "force-dynamic";

const FEATURE_ICONS: Record<string, ComponentType<LucideProps>> = {
  "heart-handshake": HeartHandshake,
  "map-pin": MapPin,
  "badge-check": BadgeCheck,
  "bed-double": BedDouble,
  sparkles: Sparkles,
};

export default async function HomePage() {
  const [{ property, content }, rooms, amenities, gallery, posts] = await Promise.all([
    getSettings(),
    getPublicRooms(),
    getPropertyAmenities(),
    prisma.galleryImage.findMany({ where: { isPublished: true }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }], take: 8 }),
    prisma.post.findMany({ where: { isPublished: true, isArchived: false }, orderBy: [{ publishedAt: "desc" }], take: 3 }),
  ]);

  const featured = rooms.filter((r) => r.isFeatured).slice(0, 3);
  const featuredRooms = featured.length > 0 ? featured : rooms.slice(0, 3);
  const whatsapp = property.whatsappNumber || publicEnv.whatsappNumber;
  const maps = property.googleMapsUrl || publicEnv.googleMapsUrl;
  const heroImage = content.heroImageUrl || gallery.find((g) => g.isFeatured)?.url || gallery[0]?.url || rooms.find((r) => r.images[0])?.images[0]?.url;
  const address = [property.addressLine1, property.addressLine2, property.city, property.state].filter(Boolean).join(", ");

  return (
    <>
      <LodgingJsonLd />

      {/* 1. Hero + 2. Search */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {heroImage ? (
            <Image src={heroImage} alt="" fill priority sizes="100vw" className="object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_top,var(--brand-soft),var(--sand)_60%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-background" />
        </div>
        <div className="container-page flex flex-col items-center pt-20 pb-10 text-center sm:pt-28 md:pt-36">
          <p className="mb-3 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white backdrop-blur">
            {property.city}{property.state ? `, ${property.state}` : ""}
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold text-white drop-shadow-sm sm:text-5xl md:text-6xl">{content.heroTitle}</h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">{content.heroSubtitle || property.tagline}</p>
          <div className="mt-10 w-full max-w-4xl text-left">
            <SearchWidget />
          </div>
        </div>
      </section>

      {/* 3. Introduction */}
      <section className="container-page grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">About the homestay</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{content.aboutTitle}</h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground whitespace-pre-line">{content.aboutText}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="xl"><Link href="/rooms">Explore rooms <ArrowRight aria-hidden /></Link></Button>
            <Button asChild size="xl" variant="outline"><Link href="/about">Our story</Link></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat value={String(rooms.filter((r) => r.type === "PRIVATE_ROOM").length)} label="Private rooms" />
          <Stat value={String(rooms.find((r) => r.type === "DORMITORY")?.capacity ?? 0)} label="Dormitory beds" />
          <Stat value={property.checkInTime} label="Check-in from" />
          <Stat value={property.checkOutTime} label="Check-out by" />
        </div>
      </section>

      {/* 4. Featured rooms */}
      <section className="bg-sand py-16 md:py-24">
        <div className="container-page">
          <SectionHeading eyebrow="Stay with us" title="Featured rooms" href="/rooms" linkLabel="All rooms" />
          {featuredRooms.length === 0 ? (
            <EmptyNote>Rooms will appear here once the owner publishes them.</EmptyNote>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredRooms.map((room) => <RoomCard key={room.id} room={room} currency={property.currency} />)}
            </div>
          )}
        </div>
      </section>

      {/* 5. Amenities */}
      {amenities.length > 0 && (
        <section className="container-page py-16 md:py-24">
          <SectionHeading eyebrow="Comforts" title="Amenities" />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {amenities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-deep"><AmenityIcon name={a.icon} className="size-5" /></span>
                <span className="text-sm font-medium">{a.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. Why choose */}
      {content.whyChooseUs.length > 0 && (
        <section className="bg-brand-deep py-16 text-brand-foreground md:py-24">
          <div className="container-page">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-foreground/70">Why {property.name}</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Hospitality you can count on</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {content.whyChooseUs.map((f) => {
                const Icon = FEATURE_ICONS[f.icon] ?? Sparkles;
                return (
                  <div key={f.title} className="rounded-2xl border border-white/15 bg-white/5 p-6">
                    <Icon className="size-7" aria-hidden />
                    <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm text-brand-foreground/80">{f.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 7. Gallery */}
      <section className="container-page py-16 md:py-24">
        <SectionHeading eyebrow="Take a look" title="Gallery" href="/gallery" linkLabel="View gallery" />
        {gallery.length === 0 ? (
          <EmptyNote>Photos are on their way. Follow us on Instagram for the latest pictures.</EmptyNote>
        ) : (
          <GalleryStrip images={gallery.map((g) => ({ id: g.id, url: g.url, alt: g.alt, caption: g.caption }))} />
        )}
      </section>

      {/* 8. Latest posts */}
      <section className="bg-sand py-16 md:py-24">
        <div className="container-page">
          <SectionHeading eyebrow="Updates" title="Latest posts" href="/posts" linkLabel="All posts" />
          {posts.length === 0 ? (
            <EmptyNote>No posts yet. Updates and Instagram highlights will appear here.</EmptyNote>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => <PostCard key={p.id} post={{ id: p.id, slug: p.slug, title: p.title, caption: p.caption, imageUrl: p.imageUrl, source: p.source, instagramUrl: p.instagramUrl, publishedAt: p.publishedAt }} />)}
            </div>
          )}
        </div>
      </section>

      {/* 9. Location + 10. Contact + 11. WhatsApp CTA */}
      <section className="container-page grid gap-8 py-16 md:grid-cols-2 md:py-24">
        <div className="rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Find us</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Location</h2>
          {address && <p className="mt-3 flex items-start gap-2 text-muted-foreground"><MapPin className="mt-1 size-4 shrink-0 text-brand" aria-hidden />{address}</p>}
          {property.googleMapsEmbedUrl ? (
            <iframe title={`${property.name} on Google Maps`} src={property.googleMapsEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="mt-5 aspect-video w-full rounded-xl border" />
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            {maps && <Button asChild size="lg"><a href={maps} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></Button>}
            <Button asChild size="lg" variant="outline"><Link href="/location">Directions & nearby</Link></Button>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-[linear-gradient(135deg,var(--brand),var(--brand-deep))] p-6 text-brand-foreground shadow-lift sm:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-foreground/70">Talk to the owner</p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Questions? We reply quickly.</h2>
            <p className="mt-3 text-brand-foreground/85">Prefer to pay directly by UPI or on arrival? Message us on WhatsApp and we will confirm your stay personally.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {whatsapp && (
              <Button asChild size="xl" className="bg-white text-brand-deep hover:bg-white/90">
                <a href={whatsappLink(whatsapp, generalEnquiryMessage(property.name))} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden /> WhatsApp</a>
              </Button>
            )}
            {property.phone && (
              <Button asChild size="xl" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <a href={telLink(property.phone)}><Phone aria-hidden /> Call now</a>
              </Button>
            )}
            <Button asChild size="xl" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link href="/contact">Send a message</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center shadow-soft">
      <p className="font-heading text-3xl font-semibold text-brand-deep">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
