import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { resendEmailLog } from "@/lib/email/retry";

/** POST /api/admin/emails/:id/resend — re-render and resend a failed booking/receipt email. */
export const POST = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const ip = clientIp(req);
  await resendEmailLog(id, admin.id, ip === "unknown" ? null : ip);
  return ok({ resent: true });
});
