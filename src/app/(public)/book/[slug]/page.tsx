import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Users } from "lucide-react";
import { BookingForm } from "@/components/booking/booking-form";
import { PriceSummary } from "@/components/booking/price-summary";
import { SearchWidget } from "@/components/booking/search-widget";
import { EmptyNote, PageHero } from "@/components/layout/section";
import { RoomImagePlaceholder } from "@/components/rooms/room-image-placeholder";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { getAvailableRooms, validateSearchRange } from "@/lib/booking/availability-service";
import { formatDateDisplay, formatDateOnly } from "@/lib/booking/dates";
import { publicEnv, integrations } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { getPublicRoomBySlug } from "@/lib/rooms/service";
import { getSettings } from "@/lib/settings/service";
import { availabilityQuerySchema } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book your stay", robots: { index: false } };

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookRoomPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const room = await getPublicRoomBySlug(slug);
  if (!room) notFound();

  const { property, booking: bookingSettings, policies } = await getSettings();
  const parsed = availabilityQuerySchema.safeParse({ checkIn: sp.checkIn, checkOut: sp.checkOut, guests: sp.guests ?? String(room.minGuests) });

  if (!parsed.success) {
    return (
      <>
        <PageHero eyebrow="Book" title={room.name} description="Choose your dates and number of guests to continue.">
          <div className="mt-8"><SearchWidget /></div>
        </PageHero>
      </>
    );
  }

  const { checkIn, checkOut, guests } = parsed.data;
  let problem: string | null = null;
  try {
    validateSearchRange(checkIn, checkOut, guests, bookingSettings);
  } catch (err) {
    problem = isAppError(err) ? err.message : "Please check your search.";
  }

  const [result] = problem ? [] : await getAvailableRooms({ checkIn, checkOut, guestCount: guests, roomId: room.id });
  const unavailable = !result || !result.availability.isAvailable || !result.quote;
  const user = await getCurrentUser();
  const whatsappNumber = property.whatsappNumber || publicEnv.whatsappNumber;
  const modes = {
    online: bookingSettings.allowOnlinePayment && integrations().razorpay,
    whatsapp: bookingSettings.allowWhatsappBooking && Boolean(whatsappNumber),
  };
  const primaryImage = room.images[0];
  const searchQs = new URLSearchParams({ checkIn: formatDateOnly(checkIn), checkOut: formatDateOnly(checkOut), guests: String(guests) }).toString();

  return (
    <div className="container-page py-10 lg:py-14">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/rooms" className="hover:underline">Rooms</Link></li>
          <li aria-hidden>/</li>
          <li><Link href={`/rooms/${room.slug}`} className="hover:underline">{room.name}</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">Book</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Complete your booking</h1>
          <p className="mt-2 text-muted-foreground">Enter guest details below. Your price is locked to the live rates shown on the right.</p>

          <div className="mt-8">
            {problem ? (
              <EmptyNote>{problem} <Link href={`/rooms/${room.slug}`} className="underline">Change dates</Link>.</EmptyNote>
            ) : unavailable ? (
              <EmptyNote>
                {room.name} is no longer available for these dates and guest count.{" "}
                <Link href={`/availability?${searchQs}`} className="underline">See other options</Link> or <Link href="/contact" className="underline">contact the owner</Link>.
              </EmptyNote>
            ) : (
              <BookingForm
                roomId={room.id}
                checkIn={formatDateOnly(checkIn)}
                checkOut={formatDateOnly(checkOut)}
                guestCount={guests}
                modes={modes}
                isDormitory={room.type === "DORMITORY"}
                defaults={user ? { name: user.name, email: user.email, phone: user.phone ?? "" } : undefined}
              />
            )}
          </div>

          {!user && (
            <p className="mt-8 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Have an account? <Link href={`/login?next=${encodeURIComponent(`/book/${room.slug}?${searchQs}`)}`} className="font-medium text-brand underline">Sign in</Link> to pre-fill your details and keep all your bookings in one place. Booking as a guest works too.
            </p>
          )}
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <div className="relative aspect-[16/10]">
              {primaryImage ? (
                <Image src={primaryImage.url} alt={primaryImage.alt ?? room.name} fill sizes="380px" className="object-cover" />
              ) : (
                <RoomImagePlaceholder type={room.type} />
              )}
            </div>
            <div className="space-y-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">{room.category}</p>
                <h2 className="text-xl font-semibold">{room.name}</h2>
                {room.bedConfiguration && <p className="text-sm text-muted-foreground">{room.bedConfiguration}</p>}
              </div>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" aria-hidden />{formatDateDisplay(checkIn)} → {formatDateDisplay(checkOut)}</li>
                <li className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" aria-hidden />{guests} guest{guests === 1 ? "" : "s"}{room.type === "DORMITORY" ? " · dormitory beds" : ""}</li>
                <li className="text-xs text-muted-foreground">Check-in from {property.checkInTime} · Check-out by {property.checkOutTime}</li>
              </ul>
              {result?.quote ? (
                <PriceSummary
                  currency={property.currency}
                  nights={result.quote.nights}
                  guestCount={guests}
                  units={result.quote.units}
                  isDormitory={room.type === "DORMITORY"}
                  roomCharges={result.quote.roomCharges}
                  taxRate={result.quote.taxRate}
                  taxLabel={result.quote.taxLabel}
                  taxAmount={result.quote.taxAmount}
                  totalAmount={result.quote.totalAmount}
                  perNight={result.quote.perNight}
                  className="border-t pt-4"
                />
              ) : null}
              <Button asChild variant="outline" size="sm" className="w-full"><Link href={`/availability?${searchQs}`}>Change dates or room</Link></Button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Cancellation policy</p>
            <p className="mt-1 line-clamp-4">{policies.cancellationPolicy}</p>
            <Link href="/policies" className="mt-1 inline-block underline">Read all policies</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
