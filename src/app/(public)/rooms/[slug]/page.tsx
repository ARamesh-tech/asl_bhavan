import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, Clock, MessageCircle, Ruler, Users } from "lucide-react";
import { SearchWidget } from "@/components/booking/search-widget";
import { RoomAvailabilityCalendar } from "@/components/rooms/room-availability-calendar";
import { RoomGallery } from "@/components/rooms/room-gallery";
import { AmenityIcon } from "@/components/rooms/amenity-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { getPublicRoomBySlug } from "@/lib/rooms/service";
import { getSettings } from "@/lib/settings/service";
import { roomEnquiryMessage, whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) return { title: "Room not found" };
  return {
    title: `${room.name} · ${room.category}`,
    description: room.shortDescription ?? room.description.slice(0, 160),
    openGraph: room.images[0] ? { images: [{ url: room.images[0].url }] } : undefined,
  };
}

export default async function RoomDetailPage({ params }: Props) {
  const { slug } = await params;
  const [room, { property, policies, booking }] = await Promise.all([getPublicRoomBySlug(slug), getSettings()]);
  if (!room) notFound();

  const isDorm = room.type === "DORMITORY";
  const whatsapp = property.whatsappNumber || publicEnv.whatsappNumber;

  return (
    <article className="container-page py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap gap-1.5">
          <li><Link href="/" className="hover:underline">Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/rooms" className="hover:underline">Rooms</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">{room.name}</li>
        </ol>
      </nav>

      <RoomGallery images={room.images} roomName={room.name} type={room.type} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{room.category}</Badge>
              {room.roomNumber && <Badge variant="outline">Room {room.roomNumber}</Badge>}
              {isDorm && <Badge variant="outline">Shared dormitory</Badge>}
            </div>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{room.name}</h1>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="inline-flex items-center gap-1.5"><Users className="size-4 text-brand" aria-hidden /> {isDorm ? `${room.capacity} beds · ${room.minGuests}–${room.maxGuests} guests per booking` : `Up to ${room.maxGuests} guests`}</li>
              {room.bedConfiguration && <li className="inline-flex items-center gap-1.5"><BedDouble className="size-4 text-brand" aria-hidden /> {room.bedConfiguration}</li>}
              {room.sizeSqFt && <li className="inline-flex items-center gap-1.5"><Ruler className="size-4 text-brand" aria-hidden /> {room.sizeSqFt} sq ft</li>}
              <li className="inline-flex items-center gap-1.5"><Clock className="size-4 text-brand" aria-hidden /> Check-in {property.checkInTime} · Check-out {property.checkOutTime}</li>
            </ul>
          </header>

          <section aria-labelledby="desc">
            <h2 id="desc" className="text-xl font-semibold">About this {isDorm ? "dormitory" : "room"}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{room.description}</p>
          </section>

          {room.amenities.length > 0 && (
            <section aria-labelledby="amen">
              <h2 id="amen" className="text-xl font-semibold">Amenities</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {room.amenities.map((a) => (
                  <li key={a.id} className="flex items-center gap-2.5 text-sm"><span className="grid size-8 place-items-center rounded-md bg-brand-soft text-brand-deep"><AmenityIcon name={a.icon} className="size-4" /></span>{a.name}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="avail">
            <h2 id="avail" className="text-xl font-semibold">Availability</h2>
            <p className="mt-1 text-sm text-muted-foreground">{isDorm ? "Numbers show free beds per night." : "Live availability for the coming weeks."}</p>
            <div className="mt-4">
              <RoomAvailabilityCalendar roomSlug={room.slug} isDormitory={isDorm} capacity={room.capacity} />
            </div>
          </section>

          <section aria-labelledby="rules" className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 id="rules" className="text-xl font-semibold">House rules</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{room.rules || policies.houseRules}</p>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Cancellation policy</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{policies.cancellationPolicy}</p>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-card p-5 shadow-lift sm:p-6">
            <p className="text-sm text-muted-foreground">From</p>
            <p className="text-3xl font-semibold text-brand-deep">{formatMoney(room.displayPrice, property.currency)} <span className="text-base font-normal text-muted-foreground">/ {room.priceUnit}</span></p>
            {room.weekendPrice && <p className="mt-1 text-xs text-muted-foreground">Weekend nights {formatMoney(room.weekendPrice, property.currency)}</p>}
            {booking.taxEnabled && <p className="mt-1 text-xs text-muted-foreground">+ {booking.taxRate}% {booking.taxLabel}</p>}
            <div className="mt-5">
              <SearchWidget compact maxGuests={room.maxGuests} initial={{ guests: Math.min(2, room.maxGuests) }} />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Exact total is calculated for your dates before payment.</p>
            {whatsapp && (
              <Button asChild variant="outline" size="xl" className="mt-4 w-full">
                <a href={whatsappLink(whatsapp, roomEnquiryMessage({ propertyName: property.name, roomName: room.name }))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden /> Contact Owner
                </a>
              </Button>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
