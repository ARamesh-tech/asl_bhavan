import Link from "next/link";
import { StatusLegend, statusStyles, type NightStatus } from "@/components/booking/status-legend";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CalendarRow } from "@/lib/booking/availability-service";
import { formatDateDisplay } from "@/lib/booking/dates";
import { cn } from "cn";

/**
 * Units × nights grid. Each cell shows the status colour + symbol (and free-bed count for
 * dormitories). Hovering/focusing a cell lists the bookings/blocks behind it; clicking a
 * booking opens it.
 */
export function OccupancyGrid({ rows, dates, todayKey }: { rows: CalendarRow[]; dates: string[]; todayKey: string }) {
  return (
    <div className="space-y-3">
      <StatusLegend dormitory statuses={["AVAILABLE", "PARTIALLY_AVAILABLE", "BOOKED", "CHECKED_IN", "BLOCKED", "MAINTENANCE"]} />
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">Unit</th>
              {dates.map((d) => {
                const day = new Date(`${d}T00:00:00Z`);
                const weekend = [0, 6].includes(day.getUTCDay());
                return (
                  <th key={d} scope="col" className={cn("min-w-9 px-0.5 py-2 text-center font-medium", d === todayKey ? "text-brand" : weekend ? "text-foreground" : "text-muted-foreground")}>
                    <span className="block text-[10px] uppercase">{day.toLocaleDateString("en-IN", { weekday: "narrow", timeZone: "UTC" })}</span>
                    <span className={cn("block", d === todayKey && "rounded-full bg-brand text-white")}>{day.getUTCDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.room.id} className="border-t">
                <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-medium whitespace-nowrap">
                  <Link href={`/admin/rooms/${row.room.id}`} className="hover:underline">{row.room.name}</Link>
                  {row.room.type === "DORMITORY" && <span className="ml-1 text-muted-foreground">({row.room.capacity} beds)</span>}
                  {(!row.room.isActive || row.room.status !== "ACTIVE") && <span className="ml-1 text-status-maintenance">· {row.room.status.toLowerCase()}</span>}
                </th>
                {row.cells.map((cell) => {
                  const status: NightStatus = row.room.status === "MAINTENANCE" ? "MAINTENANCE" : cell.checkedIn && cell.status === "BOOKED" ? "CHECKED_IN" : cell.status;
                  const style = statusStyles[status];
                  const label = row.room.type === "DORMITORY" && cell.status === "PARTIALLY_AVAILABLE" ? String(cell.available) : style.symbol;
                  const hasDetail = cell.bookings.length > 0 || cell.blocks.length > 0;
                  const cellEl = (
                    <div
                      tabIndex={hasDetail ? 0 : -1}
                      aria-label={`${row.room.name} ${formatDateDisplay(new Date(`${cell.date}T00:00:00Z`))}: ${style.label}${row.room.type === "DORMITORY" ? `, ${cell.available} free` : ""}`}
                      className={cn("mx-auto flex size-8 items-center justify-center rounded-md border font-semibold", style.cell, hasDetail && "cursor-pointer")}
                    >
                      {label}
                    </div>
                  );
                  return (
                    <td key={cell.date} className={cn("px-0.5 py-1", cell.date === todayKey && "bg-brand-soft/30")}>
                      {hasDetail ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{cellEl}</TooltipTrigger>
                          <TooltipContent className="max-w-xs space-y-1 text-xs">
                            {cell.bookings.map((b) => (
                              <p key={b.id}>
                                <Link href={`/admin/bookings/${b.id}`} className="font-mono underline">{b.bookingReference}</Link> · {b.guestName} · {b.guestCount}p · {formatDateDisplay(b.checkIn)}→{formatDateDisplay(b.checkOut)} · {b.status.toLowerCase().replace("_", " ")}
                              </p>
                            ))}
                            {cell.blocks.map((bl) => (
                              <p key={bl.id}>Block: {bl.type.toLowerCase().replace("_", " ")}{bl.bedsBlocked ? ` (${bl.bedsBlocked} beds)` : ""}{bl.reason ? ` — ${bl.reason}` : ""}</p>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      ) : cellEl}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
