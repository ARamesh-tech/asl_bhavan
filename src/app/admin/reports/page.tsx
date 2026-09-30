import type { Metadata } from "next";
import { Download } from "lucide-react";
import { AdminPageHeader, Panel, StatCard } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { getReportData, reportRangeSchema, resolveRange } from "@/lib/admin/reports-service";
import { formatDateOnly } from "@/lib/booking/dates";
import { BOOKING_SOURCE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import type { BookingSource } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const parsed = reportRangeSchema.safeParse({ from: sp.from, to: sp.to, group: sp.group });
  const range = resolveRange(parsed.success ? parsed.data : {});
  const data = await getReportData(range);
  const from = formatDateOnly(range.from);
  const to = formatDateOnly(range.to);
  const qs = new URLSearchParams({ from, to, group: range.group }).toString();
  const maxRevenue = Math.max(1, ...data.buckets.map((b) => b.stayRevenue));

  return (
    <>
      <AdminPageHeader
        title="Reports"
        description="Occupancy and revenue by period. Stay revenue spreads each booking across its nights; “collected” follows payment dates."
        actions={<Button asChild variant="outline"><a href={`/api/admin/reports/export?${qs}`}><Download aria-hidden /> Export CSV</a></Button>}
      />

      <form method="get" className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-[auto_auto_auto_auto] sm:items-end">
        <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-muted-foreground">From</span><input type="date" name="from" defaultValue={from} className="h-10 rounded-lg border border-input bg-background px-3" /></label>
        <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-muted-foreground">To (exclusive)</span><input type="date" name="to" defaultValue={to} className="h-10 rounded-lg border border-input bg-background px-3" /></label>
        <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-muted-foreground">Group by</span>
          <select name="group" defaultValue={range.group} className="h-10 rounded-lg border border-input bg-background px-3">
            <option value="day">Day</option>
            <option value="month">Month</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-medium text-white">Apply</button>
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Occupancy" value={`${data.totals.occupancyPct}%`} hint={`${data.totals.privateUnitNights} room-nights + ${data.totals.dormBedNights} bed-nights sold`} />
        <StatCard label="Stay revenue" value={formatMoney(data.totals.stayRevenue, "INR")} hint={`${data.totals.bookings} bookings in range`} />
        <StatCard label="Collected" value={formatMoney(data.totals.collected, "INR")} hint="Payments dated in range, net of refunds" />
        <StatCard label="Avg stay / lead time" value={data.avgStayNights != null ? `${data.avgStayNights} nights` : "—"} hint={data.leadTimeDays != null ? `Booked ${data.leadTimeDays} days ahead on average` : "No bookings in range"} />
      </div>

      <Panel title={`By ${range.group}`} className="mb-6">
        {data.buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data for this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-semibold">Period</th>
                  <th className="px-2 py-2 font-semibold">Revenue</th>
                  <th className="px-2 py-2 text-right font-semibold">Occupancy</th>
                  <th className="px-2 py-2 text-right font-semibold">Rooms</th>
                  <th className="px-2 py-2 text-right font-semibold">Dorm beds</th>
                  <th className="px-2 py-2 text-right font-semibold">Stay revenue</th>
                  <th className="px-2 py-2 text-right font-semibold">Collected</th>
                  <th className="px-2 py-2 text-right font-semibold">Bookings</th>
                  <th className="px-2 py-2 text-right font-semibold">Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {data.buckets.map((b) => (
                  <tr key={b.key} className="border-t">
                    <td className="px-2 py-2 whitespace-nowrap font-medium">{b.label}</td>
                    <td className="px-2 py-2 w-48">
                      <div className="h-2.5 w-full rounded-full bg-muted" aria-hidden><div className="h-2.5 rounded-full bg-brand" style={{ width: `${Math.round((b.stayRevenue / maxRevenue) * 100)}%` }} /></div>
                    </td>
                    <td className="px-2 py-2 text-right">{b.occupancyPct}%</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{b.privateUnitNights}/{b.privateAvailable}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{b.dormBedNights}/{b.dormAvailable}</td>
                    <td className="px-2 py-2 text-right">{formatMoney(b.stayRevenue, "INR")}</td>
                    <td className="px-2 py-2 text-right">{formatMoney(b.collected, "INR")}</td>
                    <td className="px-2 py-2 text-right">{b.bookings}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{b.cancellations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="By accommodation">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="py-1.5 font-semibold">Unit</th><th className="py-1.5 text-right font-semibold">Occupancy</th><th className="py-1.5 text-right font-semibold">Bookings</th><th className="py-1.5 text-right font-semibold">Revenue</th></tr>
            </thead>
            <tbody>
              {data.byRoom.map((r) => (
                <tr key={r.roomId} className="border-t">
                  <td className="py-2">{r.name}<span className="block text-xs text-muted-foreground">{r.type === "DORMITORY" ? "dormitory · bed-nights" : "private room"}</span></td>
                  <td className="py-2 text-right">{r.occupancyPct}%<span className="block text-xs text-muted-foreground">{r.unitNights}/{r.available}</span></td>
                  <td className="py-2 text-right">{r.bookings}</td>
                  <td className="py-2 text-right font-medium">{formatMoney(r.revenue, "INR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="By booking source">
          {data.bySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings in range.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="py-1.5 font-semibold">Source</th><th className="py-1.5 text-right font-semibold">Bookings</th><th className="py-1.5 text-right font-semibold">Revenue</th></tr>
              </thead>
              <tbody>
                {data.bySource.map((s) => (
                  <tr key={s.source} className="border-t">
                    <td className="py-2">{BOOKING_SOURCE_LABELS[s.source as BookingSource] ?? s.source}</td>
                    <td className="py-2 text-right">{s.bookings}</td>
                    <td className="py-2 text-right font-medium">{formatMoney(s.revenue, "INR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
