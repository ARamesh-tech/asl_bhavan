import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok } from "@/lib/api/respond";
import { createPost } from "@/lib/admin/content-service";
import { parsePostForm } from "@/lib/admin/post-form";
import { requireAdmin } from "@/lib/auth/guards";
import { ValidationError } from "@/lib/errors";

/** POST /api/admin/posts — multipart: post fields + optional image file. */
export const POST = handleRoute(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const form = await req.formData().catch(() => null);
  if (!form) throw new ValidationError("Invalid form data.");
  const { data, file } = parsePostForm(form);
  const ip = clientIp(req);
  const post = await createPost(data, file, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok({ post }, { status: 201 });
});
