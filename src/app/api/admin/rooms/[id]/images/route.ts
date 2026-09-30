import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { addRoomImage } from "@/lib/admin/rooms-service";
import { ValidationError } from "@/lib/errors";
import { storeImage } from "@/lib/storage";

/** POST multipart/form-data { file, alt?, caption?, isPrimary? } → uploads to storage and attaches to the room. */
export const POST = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new ValidationError("Choose an image file to upload.", { file: "Required" });

  const stored = await storeImage(file, "rooms");
  const ip = clientIp(req);
  const image = await addRoomImage(
    id,
    { url: stored.url, storageKey: stored.key, alt: String(form.get("alt") ?? "").slice(0, 200), caption: String(form.get("caption") ?? "").slice(0, 300), isPrimary: form.get("isPrimary") === "true" },
    { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip },
  );
  return ok({ image }, { status: 201 });
});
