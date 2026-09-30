"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { addDays, dateOnly, formatDateOnly, todayInTimeZone } from "@/lib/booking/dates";
import { StatusLegend, statusStyles, type NightStatus } from "@/components/booking/status-legend";

type ApiNight = { date: string; available: number; status: NightStatus };
type ApiResult = { capacity: number; type: "PRIVATE_ROOM" | "DORMITORY"; nights: ApiNight[] };

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Month view of a single unit's availability. Every cell conveys state with colour AND
 * a symbol/number, and exposes a full text label to assistive tech.
 */
export function RoomAvailabilityCalendar({ roomSlug, isDormitory, capacity }: { roomSlug: string; isDormitory: boolean; capacity: number }) {
  const today = useMemo(() => todayInTimeZone(), []);
  const [monthStart, setMonthStart] = useState(() => dateOnly(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  const monthEnd = useMemo(() => dateOnly(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 2, 1), [monthStart]);
  const from = monthStart < today ? today : monthStart;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["room-availability", roomSlug, formatDateOnly(from), formatDateOnly(monthEnd)],
    queryFn: () => apiFetch<ApiResult>(`/api/rooms/${roomSlug}/availability?from=${formatDateOnly(from)}&to=${formatDateOnly(monthEnd)}`),
    enabled: monthEnd > today,
  });

  const byDate = useMemo(() => new Map((data?.nights ?? []).map((n) => [n.date, n])), [data]);

  // Build a Monday-first grid.
  const leading = (monthStart.getUTCDay() + 6) % 7;
  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);
  const cells: Array<Date | null> = [...Array<null>(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i))];

  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart);
  const canGoBack = monthStart > dateOnly(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
  const canGoForward = monthStart < addDays(today, 330);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setMonthStart((m) => dateOnly(m.getUTCFullYear(), m.getUTCMonth(), 1))} disabled={!canGoBack} aria-label="Previous month"><ChevronLeft /></Button>
        <h3 className="text-base font-semibold" aria-live="polite">{monthLabel}</h3>
        <Button variant="outline" size="icon" onClick={() => setMonthStart((m) => dateOnly(m.getUTCFullYear(), m.getUTCMonth() + 2, 1))} disabled={!canGoForward} aria-label="Next month"><ChevronRight /></Button>
      </div>

      <div role="grid" aria-label={`Availability for ${monthLabel}`} className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((d) => <div key={d} role="columnheader" className="py-1 font-medium text-muted-foreground">{d}</div>)}
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} role="gridcell" aria-hidden />;
          const key = formatDateOnly(date);
          const night = byDate.get(key);
          const past = date < today;
          if (past) {
            return <div key={key} role="gridcell" aria-label={`${key}, past`} className="rounded-md py-2 text-muted-foreground/40">{date.getUTCDate()}</div>;
          }
          if (isLoading || !night) {
            return <Skeleton key={key} className="h-10 rounded-md" />;
          }
          const style = statusStyles[night.status];
          const label = isDormitory
            ? `${key}: ${night.available} of ${capacity} beds free`
            : `${key}: ${style.label}`;
          return (
            <div key={key} role="gridcell" aria-label={label} title={label} className={`flex h-10 flex-col items-center justify-center rounded-md border text-[11px] leading-tight ${style.cell}`}>
              <span className="font-semibold">{date.getUTCDate()}</span>
              <span aria-hidden>{isDormitory ? (night.available > 0 ? `${night.available}` : style.symbol) : style.symbol}</span>
            </div>
          );
        })}
      </div>

      {isError && <p role="alert" className="mt-3 text-sm text-destructive">Could not load availability. Please try again.</p>}
      <StatusLegend className="mt-4" dormitory={isDormitory} />
    </div>
  );
}
