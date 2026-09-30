import Image from "next/image";
import Link from "next/link";
import { BedDouble, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { PublicRoom } from "@/lib/rooms/service";
import { AmenityIcon } from "./amenity-icon";
import { RoomImagePlaceholder } from "./room-image-placeholder";

export function RoomCard({
  room,
  currency,
  bookHref,
  availability,
}: {
  room: PublicRoom;
  currency: string;
  /** Link for "Book Now"; defaults to the room's detail page. */
  bookHref?: string;
  /** Optional live availability badge (search results). */
  availability?: { isAvailable: boolean; availableUnits: number; reason?: string; total?: number };
}) {
  const image = room.images[0];
  const detailHref = `/rooms/${room.slug}`;
  const isDorm = room.type === "DORMITORY";

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border-border/70 p-0 shadow-soft transition-shadow hover:shadow-lift">
      <Link href={detailHref} className="relative block aspect-[4/3] overflow-hidden bg-sand" aria-label={`View ${room.name}`}>
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? room.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <RoomImagePlaceholder type={room.type} />
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge className="bg-card/90 text-foreground backdrop-blur" variant="secondary">{room.category}</Badge>
          {room.isFeatured && <Badge className="bg-brand text-brand-foreground">Featured</Badge>}
        </div>
        {availability && (
          <div className="absolute right-3 bottom-3">
            <AvailabilityBadge {...availability} isDorm={isDorm} />
          </div>
        )}
      </Link>

      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold leading-tight">{room.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="size-4" aria-hidden /> {isDorm ? `${room.capacity} beds` : `Up to ${room.maxGuests} guests`}</span>
              {room.bedConfiguration && <span className="inline-flex items-center gap-1"><BedDouble className="size-4" aria-hidden /> {room.bedConfiguration}</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-brand-deep">{formatMoney(room.displayPrice, currency)}</p>
            <p className="text-xs text-muted-foreground">per {room.priceUnit}</p>
          </div>
        </div>
        {room.shortDescription && <p className="line-clamp-2 text-sm text-muted-foreground">{room.shortDescription}</p>}
        {room.amenities.length > 0 && (
          <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1.5 pt-1 text-xs text-muted-foreground" aria-label="Amenities">
            {room.amenities.slice(0, 4).map((a) => (
              <li key={a.id} className="inline-flex items-center gap-1"><AmenityIcon name={a.icon} className="size-3.5" /> {a.name}</li>
            ))}
            {room.amenities.length > 4 && <li>+{room.amenities.length - 4} more</li>}
          </ul>
        )}
      </CardContent>

      <CardFooter className="grid grid-cols-2 gap-2 p-5 pt-0">
        <Button asChild variant="outline" size="lg"><Link href={detailHref}>View Room</Link></Button>
        <Button asChild size="lg" disabled={availability ? !availability.isAvailable : false}>
          <Link href={bookHref ?? detailHref} aria-disabled={availability ? !availability.isAvailable : undefined}>Book Now</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function AvailabilityBadge({ isAvailable, availableUnits, reason, isDorm, total }: { isAvailable: boolean; availableUnits: number; reason?: string; isDorm: boolean; total?: number }) {
  if (isAvailable) {
    return (
      <Badge className="bg-status-available-soft text-status-available border-status-available/30 border">
        <span aria-hidden>✓</span> {isDorm ? `${availableUnits}${total ? ` of ${total}` : ""} beds free` : "Available"}
      </Badge>
    );
  }
  const label =
    reason === "GUESTS_EXCEED_MAXIMUM" ? "Too many guests" :
    reason === "GUESTS_BELOW_MINIMUM" ? "Minimum guests not met" :
    reason === "INSUFFICIENT_BEDS" ? `Only ${availableUnits} beds free` :
    reason === "BLOCKED" || reason === "MAINTENANCE" ? "Unavailable" :
    isDorm ? "Fully booked" : "Booked";
  return (
    <Badge className="bg-status-booked-soft text-status-booked border-status-booked/30 border">
      <span aria-hidden>✕</span> {label}
    </Badge>
  );
}
