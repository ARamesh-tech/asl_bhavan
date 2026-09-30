import type { Metadata } from "next";
import { ManualBookingForm } from "@/components/admin/manual-booking-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/db/prisma";
import { getSettingsGroup } from "@/lib/settings/service";

export const metadata: Metadata = { title: "New booking" };

export default async function NewManualBookingPage() {
  const [rooms, property] = await Promise.all([
    prisma.room.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, type: true, capacity: true, minGuests: true, maxGuests: true } }),
    getSettingsGroup("property"),
  ]);
  return (
    <>
      <AdminPageHeader title="New manual booking" description="For phone, walk-in or WhatsApp bookings you take directly." />
      <ManualBookingForm rooms={rooms} currency={property.currency} />
    </>
  );
}
