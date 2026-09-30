import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { deleteRoomImage, setPrimaryRoomImage } from "@/lib/admin/rooms-service";
import { storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH → make this the primary image. */
export const PATCH = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const ip = clientIp(req);
  await setPrimaryRoomImage(id, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok({ updated: true });
});

export const DELETE = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const ip = clientIp(req);
  const image = await deleteRoomImage(id, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  if (image.storageKey) await storage().delete(image.storageKey);
  return ok({ deleted: true });
});
