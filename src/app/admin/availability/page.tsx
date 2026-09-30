import type { Metadata } from "next";
import Link from "next/link";
import { BlockForm } from "@/components/admin/block-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDays, formatDateDisplay, todayInTimeZone } from "@/lib/booking/dates";
import { prisma } from "@/lib/db/prisma";
import { ROOM_BLOCK_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Blocks" };

export default async function AdminAvailabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const showPast = sp.past === "1";
  const today = todayInTimeZone();
  const [rooms, blocks] = await Promise.all([
    prisma.room.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true, type: true, capacity: true, minGuests: true, maxGuests: true } }),
    prisma.roomBlock.findMany({
      where: showPast ? {} : { endDate: { gt: addDays(today, -1) } },
      orderBy: [{ startDate: "asc" }],
      take: 200,
      include: { room: { select: { name: true, type: true } }, createdBy: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Blocked dates"
        description="Take a room or dormitory beds off sale for maintenance, personal use or events. Blocks never overwrite existing bookings."
        actions={<Button asChild variant="outline"><Link href="/admin/calendar">Open calendar</Link></Button>}
      />
      <Panel title="Block dates" description="'Until' is the check-out style date — the block covers nights from 'From' up to but not including 'Until'.">
        <BlockForm rooms={rooms} defaultRoomId={typeof sp.roomId === "string" ? sp.roomId : undefined} />
      </Panel>
      <Panel
        title={showPast ? "All blocks" : "Current & upcoming blocks"}
        className="mt-6"
        actions={<Button asChild variant="ghost" size="sm"><Link href={showPast ? "/admin/availability" : "/admin/availability?past=1"}>{showPast ? "Hide past" : "Show past"}</Link></Button>}
      >
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blocks. Everything is on sale.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Unit</TableHead><TableHead>Dates</TableHead><TableHead>Type</TableHead><TableHead>Scope</TableHead><TableHead>Reason</TableHead><TableHead>By</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.room.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateDisplay(b.startDate)} → {formatDateDisplay(b.endDate)}</TableCell>
                    <TableCell>{ROOM_BLOCK_TYPE_LABELS[b.type]}</TableCell>
                    <TableCell>{b.room.type === "DORMITORY" ? (b.bedsBlocked ? `${b.bedsBlocked} beds` : "All beds") : "Whole room"}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">{b.reason ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.createdBy?.name ?? "—"}</TableCell>
                    <TableCell className="text-right"><DeleteButton url={`/api/admin/blocks/${b.id}`} title="Remove this block?" description="The dates go back on sale immediately." label="Remove" /></TableCell>
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
