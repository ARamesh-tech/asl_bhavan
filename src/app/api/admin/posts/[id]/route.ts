import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { deletePost, patchPost, updatePost } from "@/lib/admin/content-service";
import { parsePostForm } from "@/lib/admin/post-form";
import { requireAdmin } from "@/lib/auth/guards";
import { ValidationError } from "@/lib/errors";
import { postPatchSchema } from "@/lib/validation/admin";

type Ctx = { params: Promise<{ id: string }> };

function actor(req: NextRequest, adminId: string) {
  const ip = clientIp(req);
  return { adminUserId: adminId, ipAddress: ip === "unknown" ? null : ip };
}

/** PUT /api/admin/posts/:id — full update (multipart, optional new image). */
export const PUT = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  if (!form) throw new ValidationError("Invalid form data.");
  const { data, file } = parsePostForm(form);
  return ok({ post: await updatePost(id, data, file, actor(req, admin.id)) });
});

/** PATCH /api/admin/posts/:id — quick toggles (publish / archive / order). */
export const PATCH = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, postPatchSchema);
  return ok({ post: await patchPost(id, body, actor(req, admin.id)) });
});

export const DELETE = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  await deletePost(id, actor(req, admin.id));
  return ok({ deleted: true });
});
