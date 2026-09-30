import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RoomForm } from "@/components/admin/room-form";
import { prisma } from "@/lib/db/prisma";
import { getSettingsGroup } from "@/lib/settings/service";

export const metadata: Metadata = { title: "Add unit" };

export default async function NewRoomPage() {
  const [amenities, property] = await Promise.all([
    prisma.amenity.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, category: true } }),
    getSettingsGroup("property"),
  ]);
  return (
    <>
      <AdminPageHeader title="Add a room or dormitory" description="Photos and special rates can be added after saving." />
      <RoomForm amenities={amenities} currency={property.currency} />
    </>
  );
}
