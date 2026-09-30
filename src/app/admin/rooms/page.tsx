import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RoomImagePlaceholder } from "@/components/rooms/room-image-placeholder";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/money";
import { getSettingsGroup } from "@/lib/settings/service";
import { cn } from "cn";

export const metadata: Metadata = { title: "Rooms" };

export default async function AdminRoomsPage() {
  const [rooms, property] = await Promise.all([
    prisma.room.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { images: { where: { isPrimary: true }, take: 1 }, _count: { select: { bookings: { where: { deletedAt: null, status: { in: ["CONFIRMED", "CHECKED_IN", "OWNER_CONFIRMATION", "PENDING_PAYMENT"] }, checkOut: { gt: new Date() } } }, prices: true } } },
    }),
    getSettingsGroup("property"),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Rooms & pricing"
        description={`${rooms.filter((r) => r.type === "PRIVATE_ROOM").length} private rooms · ${rooms.filter((r) => r.type === "DORMITORY").length} dormitory`}
        actions={<Button asChild><Link href="/admin/rooms/new"><Plus aria-hidden /> Add unit</Link></Button>}
      />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16" />
              <TableHead>Unit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Base price</TableHead>
              <TableHead className="text-right">Weekend</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Active bookings</TableHead>
              <TableHead className="text-right">Overrides</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="relative size-12 overflow-hidden rounded-lg">
                    {r.images[0] ? <Image src={r.images[0].url} alt="" fill sizes="48px" className="object-cover" /> : <RoomImagePlaceholder type={r.type} />}
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/rooms/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
                  <p className="text-xs text-muted-foreground">{r.category}{r.roomNumber ? ` · #${r.roomNumber}` : ""}{r.isFeatured && <Star className="ml-1 inline size-3 fill-current text-brand" aria-label="Featured" />}</p>
                </TableCell>
                <TableCell>{r.type === "DORMITORY" ? "Dormitory" : "Private room"}</TableCell>
                <TableCell className="text-right">{r.type === "DORMITORY" ? `${r.capacity} beds` : `${r.minGuests}–${r.maxGuests}`}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{r.type === "DORMITORY" ? `${formatMoney((r.pricePerPerson ?? r.basePrice).toNumber(), property.currency)} / bed` : formatMoney(r.basePrice.toNumber(), property.currency)}</TableCell>
                <TableCell className="text-right">{r.weekendPrice ? formatMoney(r.weekendPrice.toNumber(), property.currency) : "—"}</TableCell>
                <TableCell>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r.isActive && r.status === "ACTIVE" ? "bg-status-available-soft text-status-available" : r.status === "MAINTENANCE" ? "bg-status-maintenance-soft text-status-maintenance" : "bg-muted text-muted-foreground")}>
                    {!r.isActive ? "Hidden" : r.status === "ACTIVE" ? "On sale" : r.status === "MAINTENANCE" ? "Maintenance" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right">{r._count.bookings}</TableCell>
                <TableCell className="text-right">{r._count.prices}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
