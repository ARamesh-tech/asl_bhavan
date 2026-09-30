import type { Metadata } from "next";
import Link from "next/link";
import { SearchWidget } from "@/components/booking/search-widget";
import { EmptyNote, PageHero } from "@/components/layout/section";
import { RoomCard } from "@/components/rooms/room-card";
import { getAvailableRooms, validateSearchRange } from "@/lib/booking/availability-service";
import { formatDateDisplay, formatDateOnly, nightsBetween } from "@/lib/booking/dates";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { getPublicRooms } from "@/lib/rooms/service";
import { getSettings } from "@/lib/settings/service";
import { availabilityQuerySchema } from "@/lib/validation/booking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Check availability", description: "Search live room and dormitory availability for your dates." };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AvailabilityPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { property, booking: bookingSettings } = await getSettings();
  const parsed = availabilityQuerySchema.safeParse({ checkIn: sp.checkIn, checkOut: sp.checkOut, guests: sp.guests ?? "2" });

  if (!parsed.success) {
    return (
      <>
        <PageHero eyebrow="Plan your stay" title="Check availability" description="Choose your dates and number of guests to see what is free and the exact total for your stay.">
          <div className="mt-8"><SearchWidget /></div>
        </PageHero>
        <div className="container-page py-12">
          <p className="text-sm text-muted-foreground">Prices and availability are calculated live from the property&apos;s booking system.</p>
        </div>
      </>
    );
  }

  const { checkIn, checkOut, guests } = parsed.data;
  let validationMessage: string | null = null;
  try {
    validateSearchRange(checkIn, checkOut, guests, bookingSettings);
  } catch (err) {
    validationMessage = isAppError(err) ? err.message : "Please check your search.";
  }

  const results = validationMessage ? [] : await getAvailableRooms({ checkIn, checkOut, guestCount: guests });
  const roomsById = new Map((await getPublicRooms()).map((r) => [r.id, r]));
  const available = results.filter((r) => r.availability.isAvailable);
  const unavailable = results.filter((r) => !r.availability.isAvailable);
  const nights = nightsBetween(checkIn, checkOut);
  const bookParams = new URLSearchParams({ checkIn: formatDateOnly(checkIn), checkOut: formatDateOnly(checkOut), guests: String(guests) });

  return (
    <>
      <PageHero eyebrow="Plan your stay" title="Check availability" description={`${formatDateDisplay(checkIn)} → ${formatDateDisplay(checkOut)} · ${nights} night${nights === 1 ? "" : "s"} · ${guests} guest${guests === 1 ? "" : "s"}`}>
        <div className="mt-8"><SearchWidget initial={{ checkIn: formatDateOnly(checkIn), checkOut: formatDateOnly(checkOut), guests }} /></div>
      </PageHero>

      <div className="container-page space-y-12 py-12">
        {validationMessage && <EmptyNote>{validationMessage}</EmptyNote>}

        {!validationMessage && (
          <section aria-labelledby="available-heading">
            <h2 id="available-heading" className="mb-6 text-2xl font-semibold">
              {available.length > 0 ? `${available.length} option${available.length === 1 ? "" : "s"} available` : "No rooms available for the selected dates"}
            </h2>
            {available.length === 0 ? (
              <EmptyNote>
                Nothing is free for these dates and guest count. Try different dates, fewer guests, or <Link href="/contact" className="underline">contact the owner</Link> — we may be able to help.
              </EmptyNote>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {available.map((r) => {
                  const room = roomsById.get(r.room.id);
                  if (!room) return null;
                  return (
                    <div key={r.room.id} className="flex flex-col gap-3">
                      <RoomCard
                        room={room}
                        currency={property.currency}
                        bookHref={`/book/${room.slug}?${bookParams.toString()}`}
                        availability={{ isAvailable: true, availableUnits: r.availability.availableUnits, total: room.type === "DORMITORY" ? room.capacity : undefined }}
                      />
                      {r.quote && (
                        <div className="rounded-xl border bg-card px-4 py-3 text-sm shadow-soft">
                          <div className="flex items-baseline justify-between">
                            <span className="text-muted-foreground">Total for {r.quote.nights} night{r.quote.nights === 1 ? "" : "s"}{room.type === "DORMITORY" ? ` × ${guests} bed${guests === 1 ? "" : "s"}` : ""}</span>
                            <span className="text-lg font-semibold text-brand-deep">{formatMoney(r.quote.totalAmount, property.currency)}</span>
                          </div>
                          {r.quote.taxAmount > 0 && <p className="text-xs text-muted-foreground">Includes {formatMoney(r.quote.taxAmount, property.currency)} {r.quote.taxLabel}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {unavailable.length > 0 && (
          <section aria-labelledby="unavailable-heading">
            <h2 id="unavailable-heading" className="mb-6 text-xl font-semibold text-muted-foreground">Not available for these dates</h2>
            <div className="grid gap-6 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
              {unavailable.map((r) => {
                const room = roomsById.get(r.room.id);
                if (!room) return null;
                return (
                  <RoomCard key={r.room.id} room={room} currency={property.currency} availability={{ isAvailable: false, availableUnits: r.availability.availableUnits, reason: r.availability.reason, total: room.type === "DORMITORY" ? room.capacity : undefined }} />
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}