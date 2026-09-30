import "server-only";
import { zodToFieldErrors } from "@/lib/api/respond";
import { ValidationError } from "@/lib/errors";
import { postUpsertSchema } from "@/lib/validation/admin";

/** Parse a multipart post form into the validated schema plus optional image file. */
export function parsePostForm(form: FormData) {
  const raw: Record<string, unknown> = {};
  for (const key of ["title", "slug", "caption", "imageUrl", "instagramUrl", "publishedAt", "sortOrder"]) {
    const v = form.get(key);
    if (typeof v === "string") raw[key] = v;
  }
  raw.isPublished = form.get("isPublished") === "true";
  const parsed = postUpsertSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(undefined, zodToFieldErrors(parsed.error));
  const file = form.get("file");
  return { data: parsed.data, file: file instanceof File && file.size > 0 ? file : null };
}
