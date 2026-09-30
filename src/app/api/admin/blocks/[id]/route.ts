import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { deleteRoomBlock } from "@/lib/admin/rooms-service";

export const DELETE = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const ip = clientIp(req);
  await deleteRoomBlock(id, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok({ deleted: true });
});
