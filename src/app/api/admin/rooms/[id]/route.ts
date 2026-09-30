import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { softDeleteRoom, upsertRoom } from "@/lib/admin/rooms-service";
import { roomUpsertSchema } from "@/lib/validation/admin";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, roomUpsertSchema);
  const ip = clientIp(req);
  const room = await upsertRoom(id, body, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok({ id: room.id, slug: room.slug });
});

export const DELETE = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const ip = clientIp(req);
  await softDeleteRoom(id, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok({ deleted: true });
});
