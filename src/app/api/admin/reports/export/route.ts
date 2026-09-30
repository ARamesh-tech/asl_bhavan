import type { NextRequest } from "next/server";
import { handleRoute, parseQuery } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { getReportData, reportCsv, reportRangeSchema, resolveRange } from "@/lib/admin/reports-service";
import { formatDateOnly } from "@/lib/booking/dates";

export const GET = handleRoute(async (req: NextRequest) => {
  await requireAdmin();
  const range = resolveRange(parseQuery(req, reportRangeSchema));
  const csv = reportCsv(await getReportData(range));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${formatDateOnly(range.from)}-to-${formatDateOnly(range.to)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
