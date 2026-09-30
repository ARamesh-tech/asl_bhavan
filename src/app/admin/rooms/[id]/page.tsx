import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { PriceOverrideForm } from "@/components/admin/price-override-form";
import { RoomForm } from "@/components/admin/room-form";
import { RoomImagesManager } from "@/components/admin/room-images-manager";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/booking/dates";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { getSettingsGroup } from "@/lib/settings/service";

export const metadata: Metadata = { title: "Edit room" };

export default async function AdminRoomEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [room, amenities, property] = await Promise.all([
    prisma.room.findFirst({
      where: { id, deletedAt: null },
      include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] }, amenities: { select: { amenityId: true } }, prices: { orderBy: { startDate: "asc" } } },
    }),
    prisma.amenity.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, category: true } }),
    getSettingsGroup("property"),
  ]);
  if (!room) notFound();

  return (
    <>
      <Link href="/admin/rooms" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> All rooms</Link>
      <AdminPageHeader
        title={room.name}
        description={`${room.category} · ${room.type === "DORMITORY" ? `${room.capacity} beds` : `up to ${room.maxGuests} guests`}`}
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/rooms/${room.slug}`} target="_blank"><ExternalLink aria-hidden /> View on site</Link></Button>
            <Button asChild variant="outline"><Link href={`/admin/availability?roomId=${room.id}`}>Block dates</Link></Button>
            <DeleteButton url={`/api/admin/rooms/${room.id}`} title={`Delete ${room.name}?`} description="The unit is hidden everywhere. Past bookings remain for reporting. Refused if active bookings exist." label="Delete unit" size="default" />
          </>
        }
      />

      <Panel title="Photos" description="First/primary photo is used on cards and in search results." className="mb-6">
        <RoomImagesManager roomId={room.id} images={room.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, isPrimary: i.isPrimary }))} />
      </Panel>

      <RoomForm
        roomId={room.id}
        amenities={amenities}
        currency={property.currency}
        initial={{
          name: room.name, slug: room.slug, roomNumber: room.roomNumber ?? "", type: room.type, category: room.category,
          shortDescription: room.shortDescription ?? "", description: room.description, capacity: room.capacity, minGuests: room.minGuests, maxGuests: room.maxGuests,
          basePrice: room.basePrice.toNumber(), pricePerPerson: room.pricePerPerson?.toNumber() ?? "", weekendPrice: room.weekendPrice?.toNumber() ?? "",
          bedConfiguration: room.bedConfiguration ?? "", sizeSqFt: room.sizeSqFt ?? "", floor: room.floor ?? "", rules: room.rules ?? "",
          status: room.status, isActive: room.isActive, isFeatured: room.isFeatured, sortOrder: room.sortOrder, amenityIds: room.amenities.map((a) => a.amenityId),
        }}
      />

      <Panel title="Special rates" description="Date-specific prices override the base/weekend price for those nights. Half-open ranges: 'Until' night is not included." className="mt-6">
        <PriceOverrideForm roomId={room.id} isDormitory={room.type === "DORMITORY"} currency={property.currency} />
        {room.prices.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Dates</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Priority</TableHead><TableHead>Label</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {room.prices.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{formatDateDisplay(p.startDate)} → {formatDateDisplay(p.endDate)}</TableCell>
                    <TableCell className="text-right">{formatMoney((room.type === "DORMITORY" ? p.pricePerPerson ?? p.price : p.price).toNumber(), property.currency)}{room.type === "DORMITORY" ? " / bed" : ""}</TableCell>
                    <TableCell className="text-right">{p.priority}</TableCell>
                    <TableCell className="text-muted-foreground">{p.reason ?? "—"}</TableCell>
                    <TableCell className="text-right"><DeleteButton url={`/api/admin/prices/${p.id}`} title="Remove this special rate?" label="Remove" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}
