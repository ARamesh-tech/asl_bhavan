import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok } from "@/lib/api/respond";
import { addGalleryImage } from "@/lib/admin/content-service";
import { requireAdmin } from "@/lib/auth/guards";
import { ValidationError } from "@/lib/errors";
import { GALLERY_CATEGORIES } from "@/lib/validation/admin";

/** POST /api/admin/gallery — multipart { file, alt?, caption?, category, isFeatured? }. */
export const POST = handleRoute(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new ValidationError("Choose an image file to upload.", { file: "Required" });
  const category = String(form.get("category") ?? "PROPERTY");
  if (!(GALLERY_CATEGORIES as readonly string[]).includes(category)) throw new ValidationError("Invalid category.", { category: "Invalid" });
  const ip = clientIp(req);
  const image = await addGalleryImage(
    file,
    { alt: String(form.get("alt") ?? "").slice(0, 200), caption: String(form.get("caption") ?? "").slice(0, 300), category: category as (typeof GALLERY_CATEGORIES)[number], isFeatured: form.get("isFeatured") === "true" },
    { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip },
  );
  return ok({ image }, { status: 201 });
});
