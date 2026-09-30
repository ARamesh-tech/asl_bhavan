import type { Metadata } from "next";
import { PageHero, EmptyNote } from "@/components/layout/section";
import { RoomCard } from "@/components/rooms/room-card";
import { getPublicRooms } from "@/lib/rooms/service";
import { getSettings } from "@/lib/settings/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rooms",
  description: "Browse our private rooms and dormitory beds, with prices, capacity and amenities.",
};

export default async function RoomsPage() {
  const [rooms, { property }] = await Promise.all([getPublicRooms(), getSettings()]);
  const privateRooms = rooms.filter((r) => r.type === "PRIVATE_ROOM");
  const dorms = rooms.filter((r) => r.type === "DORMITORY");

  return (
    <>
      <PageHero eyebrow="Accommodation" title="Rooms & dormitory" description={`${privateRooms.length} private room${privateRooms.length === 1 ? "" : "s"} and ${dorms.length ? "a shared dormitory" : "no dormitory"} at ${property.name}. Prices shown are the standard rate; search your dates for exact availability and totals.`} />
      <div className="container-page space-y-14 py-12">
        {rooms.length === 0 && <EmptyNote>No rooms are published yet. Please check back soon or contact the owner.</EmptyNote>}
        {privateRooms.length > 0 && (
          <section aria-labelledby="private-rooms">
            <h2 id="private-rooms" className="mb-6 text-2xl font-semibold">Private rooms</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {privateRooms.map((room) => <RoomCard key={room.id} room={room} currency={property.currency} />)}
            </div>
          </section>
        )}
        {dorms.length > 0 && (
          <section aria-labelledby="dormitory">
            <h2 id="dormitory" className="mb-6 text-2xl font-semibold">Dormitory</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dorms.map((room) => <RoomCard key={room.id} room={room} currency={property.currency} />)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
