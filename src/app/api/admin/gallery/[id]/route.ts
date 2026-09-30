import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { deleteGalleryImage, patchGalleryImage } from "@/lib/admin/content-service";
import { requireAdmin } from "@/lib/auth/guards";
import { galleryPatchSchema } from "@/lib/validation/admin";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, galleryPatchSchema);
  const ip = clientIp(req);
  return ok({ image: await patchGalleryImage(id, body, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip }) });
});

export const DELETE = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const ip = clientIp(req);
  await deleteGalleryImage(id, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok({ deleted: true });
});
