import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModifyBookingForm } from "@/components/admin/modify-booking-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getBookingById } from "@/lib/booking/booking-service";
import { toBookingDto } from "@/lib/booking/serialize";
import { prisma } from "@/lib/db/prisma";
import { getSettingsGroup } from "@/lib/settings/service";

export const metadata: Metadata = { title: "Modify booking" };

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) notFound();
  const [rooms, property] = await Promise.all([
    prisma.room.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true, type: true, capacity: true, minGuests: true, maxGuests: true } }),
    getSettingsGroup("property"),
  ]);
  return (
    <>
      <AdminPageHeader title={`Modify ${booking.bookingReference}`} description={`${booking.guestName} · ${booking.room.name}`} />
      <ModifyBookingForm booking={toBookingDto(booking)} rooms={rooms} currency={property.currency} />
    </>
  );
}
