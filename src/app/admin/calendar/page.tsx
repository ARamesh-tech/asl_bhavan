import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OccupancyGrid } from "@/components/admin/occupancy-grid";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { getOccupancyGrid } from "@/lib/booking/availability-service";
import { addDays, eachNight, formatDateOnly, parseDateOnly, todayInTimeZone } from "@/lib/booking/dates";

export const metadata: Metadata = { title: "Calendar" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayInTimeZone();
  const startParam = typeof sp.start === "string" ? parseDateOnly(sp.start) : null;
  const days = Math.min(62, Math.max(7, Number(sp.days) || 31));
  const start = startParam ?? addDays(today, -1);
  const end = addDays(start, days);
  const rows = await getOccupancyGrid({ start, end });
  const dates = eachNight(start, end).map(formatDateOnly);

  const nav = (s: Date) => `/admin/calendar?start=${formatDateOnly(s)}&days=${days}`;
  const monthLabel = `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} – ${addDays(end, -1).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;

  return (
    <>
      <AdminPageHeader
        title="Calendar"
        description={monthLabel}
        actions={
          <>
            <Button asChild variant="outline" size="icon" aria-label="Earlier"><Link href={nav(addDays(start, -days))}><ChevronLeft aria-hidden /></Link></Button>
            <Button asChild variant="outline"><Link href={`/admin/calendar?days=${days}`}>Today</Link></Button>
            <Button asChild variant="outline" size="icon" aria-label="Later"><Link href={nav(addDays(start, days))}><ChevronRight aria-hidden /></Link></Button>
            <div className="ml-2 flex gap-1">
              {[14, 31, 62].map((d) => (
                <Button key={d} asChild variant={d === days ? "default" : "ghost"} size="sm"><Link href={`/admin/calendar?start=${formatDateOnly(start)}&days=${d}`}>{d}d</Link></Button>
              ))}
            </div>
            <Button asChild><Link href="/admin/availability">Manage blocks</Link></Button>
          </>
        }
      />
      <OccupancyGrid rows={rows} dates={dates} todayKey={formatDateOnly(today)} />
    </>
  );
}
