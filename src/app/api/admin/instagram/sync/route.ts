import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { syncInstagram } from "@/lib/instagram/sync";

/** POST /api/admin/instagram/sync — pull latest media from the Instagram Graph API. */
export const POST = handleRoute(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const ip = clientIp(req);
  const result = await syncInstagram({ adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok(result);
});
