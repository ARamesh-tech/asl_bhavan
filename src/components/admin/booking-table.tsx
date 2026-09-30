import Link from "next/link";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/booking/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BookingWithRelations } from "@/lib/booking/booking-service";
import { formatDateDisplay } from "@/lib/booking/dates";
import { BOOKING_SOURCE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";

export function BookingTable({ rows, emptyText = "No bookings match these filters.", compact = false }: { rows: BookingWithRelations[]; emptyText?: string; compact?: boolean }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Dates</TableHead>
            {!compact && <TableHead className="text-right">Guests</TableHead>}
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            {!compact && <TableHead>Payment</TableHead>}
            {!compact && <TableHead>Source</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => {
            const total = b.totalAmount.toNumber();
            const paid = b.amountPaid.toNumber();
            return (
              <TableRow key={b.id} className={b.deletedAt ? "opacity-50" : undefined}>
                <TableCell>
                  <Link href={`/admin/bookings/${b.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">{b.bookingReference}</Link>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{b.guestName}</p>
                  <p className="text-xs text-muted-foreground">{b.guestPhone}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">{b.room.name}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDateDisplay(b.checkIn)} → {formatDateDisplay(b.checkOut)}
                  <span className="block text-xs text-muted-foreground">{b.nights} night{b.nights === 1 ? "" : "s"}</span>
                </TableCell>
                {!compact && <TableCell className="text-right">{b.guestCount}</TableCell>}
                <TableCell className="text-right whitespace-nowrap">
                  <span className="font-medium">{formatMoney(total, b.currency)}</span>
                  {paid > 0 && paid < total && <span className="block text-xs text-muted-foreground">paid {formatMoney(paid, b.currency)}</span>}
                </TableCell>
                <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                {!compact && <TableCell><PaymentStatusBadge status={b.paymentStatus} /></TableCell>}
                {!compact && <TableCell className="text-xs text-muted-foreground">{BOOKING_SOURCE_LABELS[b.source]}</TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
