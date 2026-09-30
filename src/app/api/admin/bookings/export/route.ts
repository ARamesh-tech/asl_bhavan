import type { NextRequest } from "next/server";
import { handleRoute, parseQuery } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { adminBookingFilterSchema, exportAdminBookingsCsv } from "@/lib/admin/bookings-service";
import { formatDateKey } from "@/lib/booking/dates";

export const GET = handleRoute(async (req: NextRequest) => {
  await requireAdmin();
  const filters = parseQuery(req, adminBookingFilterSchema);
  const csv = await exportAdminBookingsCsv(filters);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${formatDateKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
