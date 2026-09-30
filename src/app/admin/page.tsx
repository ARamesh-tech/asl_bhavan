import Link from "next/link";
import { BedDouble, CalendarCheck, Clock, IndianRupee, LogIn, LogOut, MessageSquare } from "lucide-react";
import { BookingTable } from "@/components/admin/booking-table";
import { AdminPageHeader, Panel, StatCard } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/admin/dashboard-service";
import { formatDateDisplay } from "@/lib/booking/dates";
import { formatMoney } from "@/lib/money";
import { getSettingsGroup } from "@/lib/settings/service";

export default async function AdminDashboardPage() {
  const [d, property] = await Promise.all([getDashboardData(), getSettingsGroup("property")]);
  const cur = property.currency;
  const occ = d.occupancy;
  const occupancyPct = occ.privateRooms + occ.dormBeds > 0 ? Math.round(((occ.occupiedPrivate + occ.occupiedDormBeds) / (occ.privateRooms + occ.dormBeds)) * 100) : 0;

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`Today, ${formatDateDisplay(d.today)} · ${d.upcomingWeek} arrival${d.upcomingWeek === 1 ? "" : "s"} in the next 7 days`}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/admin/calendar">Calendar</Link></Button>
            <Button asChild><Link href="/admin/bookings/new">New booking</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Arrivals today" value={d.arrivals.length} hint="Confirmed, not yet checked in" icon={<LogIn className="size-5" />} />
        <StatCard label="Departures today" value={d.departures.length} hint={`${d.inHouse} guest booking${d.inHouse === 1 ? "" : "s"} in house`} icon={<LogOut className="size-5" />} />
        <StatCard label="Awaiting your confirmation" value={d.pendingConfirmation.length} hint={d.pendingPayment ? `${d.pendingPayment} online payment${d.pendingPayment === 1 ? "" : "s"} in progress` : "WhatsApp / direct-payment requests"} icon={<Clock className="size-5" />} />
        <StatCard label="Occupancy tonight" value={`${occupancyPct}%`} hint={`${occ.occupiedPrivate}/${occ.privateRooms} rooms · ${occ.occupiedDormBeds}/${occ.dormBeds} dorm beds`} icon={<BedDouble className="size-5" />} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected this month" value={formatMoney(d.month.revenue, cur)} hint={`of ${formatMoney(d.month.booked, cur)} booked · ${d.month.count} stay${d.month.count === 1 ? "" : "s"}`} icon={<IndianRupee className="size-5" />} />
        <StatCard label="Fully settled" value={d.month.settledCount} hint="Bookings this month with payment complete" icon={<CalendarCheck className="size-5" />} />
        <StatCard label="New messages" value={d.newMessages} hint={<Link href="/admin/messages" className="underline">Open inbox</Link>} icon={<MessageSquare className="size-5" />} />
        <StatCard label="Units" value={occ.privateRooms + (occ.dormBeds > 0 ? 1 : 0)} hint={`${occ.privateRooms} private rooms · ${occ.dormBeds} dormitory beds`} icon={<BedDouble className="size-5" />} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel title="Awaiting owner confirmation" description="Guests who chose to pay you directly. Confirm once payment is received." actions={<Button asChild variant="ghost" size="sm"><Link href="/admin/bookings?status=OWNER_CONFIRMATION">View all</Link></Button>}>
          <BookingTable rows={d.pendingConfirmation} compact emptyText="Nothing waiting on you right now." />
        </Panel>
        <Panel title="Today's arrivals" description={`Check-in from ${property.checkInTime}`} actions={<Button asChild variant="ghost" size="sm"><Link href="/admin/bookings?status=CONFIRMED&dateField=checkIn">All confirmed</Link></Button>}>
          <BookingTable rows={d.arrivals} compact emptyText="No arrivals expected today." />
        </Panel>
        <Panel title="Today's departures" description={`Check-out by ${property.checkOutTime}`}>
          <BookingTable rows={d.departures} compact emptyText="No departures today." />
        </Panel>
        <Panel title="Recent bookings" actions={<Button asChild variant="ghost" size="sm"><Link href="/admin/bookings">All bookings</Link></Button>}>
          <BookingTable rows={d.recent} compact emptyText="No bookings yet." />
        </Panel>
      </div>
    </>
  );
}
