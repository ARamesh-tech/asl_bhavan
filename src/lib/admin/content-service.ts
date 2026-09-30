import "server-only";
import type { z } from "zod";
import type { GalleryCategory } from "@/generated/prisma/client";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { storage, storeImage } from "@/lib/storage";
import type { galleryPatchSchema, postPatchSchema, postUpsertSchema } from "@/lib/validation/admin";

type Actor = { adminUserId: string; ipAddress?: string | null };

export function slugify(input: string): string {
  return input.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "post";
}

// ───────────────────────────── Posts ─────────────────────────────

export async function createPost(data: z.output<typeof postUpsertSchema>, image: File | null, actor: Actor) {
  const slug = data.slug ?? slugify(data.title);
  if (await prisma.post.findUnique({ where: { slug }, select: { id: true } })) throw new ConflictError("A post with this slug already exists.");
  const stored = image ? await storeImage(image, "posts") : null;
  const post = await prisma.post.create({
    data: {
      title: data.title,
      slug,
      caption: data.caption ?? null,
      imageUrl: stored?.url ?? data.imageUrl ?? null,
      imageStorageKey: stored?.key ?? null,
      instagramUrl: data.instagramUrl ?? null,
      source: "WEBSITE",
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
      isPublished: data.isPublished,
      sortOrder: data.sortOrder,
      createdById: actor.adminUserId,
    },
  });
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_POST", entityType: "Post", entityId: post.id, newValue: { created: true, title: post.title, slug }, ipAddress: actor.ipAddress ?? null });
  return post;
}

export async function updatePost(id: string, data: z.output<typeof postUpsertSchema>, image: File | null, actor: Actor) {
  const prev = await prisma.post.findUnique({ where: { id } });
  if (!prev) throw new NotFoundError("Post not found.");
  const slug = data.slug ?? prev.slug;
  if (slug !== prev.slug && (await prisma.post.findUnique({ where: { slug }, select: { id: true } }))) throw new ConflictError("A post with this slug already exists.");
  const stored = image ? await storeImage(image, "posts") : null;
  const post = await prisma.post.update({
    where: { id },
    data: {
      title: data.title,
      slug,
      caption: data.caption ?? null,
      ...(stored ? { imageUrl: stored.url, imageStorageKey: stored.key } : data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      instagramUrl: data.instagramUrl ?? prev.instagramUrl,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : prev.publishedAt,
      isPublished: data.isPublished,
      sortOrder: data.sortOrder,
    },
  });
  if (stored && prev.imageStorageKey && prev.imageStorageKey !== stored.key) await storage().delete(prev.imageStorageKey).catch(() => undefined);
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_POST", entityType: "Post", entityId: id, oldValue: { title: prev.title, slug: prev.slug, isPublished: prev.isPublished }, newValue: { title: post.title, slug, isPublished: post.isPublished }, ipAddress: actor.ipAddress ?? null });
  return post;
}

export async function patchPost(id: string, patch: z.output<typeof postPatchSchema>, actor: Actor) {
  const prev = await prisma.post.findUnique({ where: { id }, select: { isPublished: true, isArchived: true, sortOrder: true, title: true } });
  if (!prev) throw new NotFoundError("Post not found.");
  const post = await prisma.post.update({ where: { id }, data: patch });
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_POST", entityType: "Post", entityId: id, oldValue: prev, newValue: patch, ipAddress: actor.ipAddress ?? null });
  return post;
}

/** Hard delete of a post (content only, no financial linkage). Instagram-sourced posts are archived instead so a re-sync does not resurrect them. */
export async function deletePost(id: string, actor: Actor) {
  const prev = await prisma.post.findUnique({ where: { id } });
  if (!prev) throw new NotFoundError("Post not found.");
  if (prev.source === "INSTAGRAM") {
    await prisma.post.update({ where: { id }, data: { isArchived: true, isPublished: false } });
  } else {
    await prisma.post.delete({ where: { id } });
    if (prev.imageStorageKey) await storage().delete(prev.imageStorageKey).catch(() => undefined);
  }
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_DELETED_POST", entityType: "Post", entityId: id, oldValue: { title: prev.title, source: prev.source }, ipAddress: actor.ipAddress ?? null });
}

// ───────────────────────────── Gallery ─────────────────────────────

export async function addGalleryImage(file: File, meta: { alt?: string; caption?: string; category: GalleryCategory; isFeatured?: boolean }, actor: Actor) {
  const stored = await storeImage(file, "gallery");
  const last = await prisma.galleryImage.aggregate({ _max: { sortOrder: true }, where: { category: meta.category } });
  const image = await prisma.galleryImage.create({
    data: {
      url: stored.url,
      storageKey: stored.key,
      alt: meta.alt?.trim() || null,
      caption: meta.caption?.trim() || null,
      category: meta.category,
      isFeatured: meta.isFeatured ?? false,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
      uploadedById: actor.adminUserId,
    },
  });
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_GALLERY", entityType: "GalleryImage", entityId: image.id, newValue: { added: true, category: meta.category }, ipAddress: actor.ipAddress ?? null });
  return image;
}

export async function patchGalleryImage(id: string, patch: z.output<typeof galleryPatchSchema>, actor: Actor) {
  const prev = await prisma.galleryImage.findUnique({ where: { id } });
  if (!prev) throw new NotFoundError("Image not found.");
  const image = await prisma.galleryImage.update({ where: { id }, data: { ...patch, alt: patch.alt === undefined ? undefined : patch.alt ?? null, caption: patch.caption === undefined ? undefined : patch.caption ?? null } });
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_GALLERY", entityType: "GalleryImage", entityId: id, oldValue: { category: prev.category, isFeatured: prev.isFeatured, isPublished: prev.isPublished }, newValue: patch, ipAddress: actor.ipAddress ?? null });
  return image;
}

export async function deleteGalleryImage(id: string, actor: Actor) {
  const prev = await prisma.galleryImage.findUnique({ where: { id } });
  if (!prev) throw new NotFoundError("Image not found.");
  await prisma.galleryImage.delete({ where: { id } });
  if (prev.storageKey) await storage().delete(prev.storageKey).catch(() => undefined);
  await recordAudit({ adminUserId: actor.adminUserId, action: "ADMIN_UPDATED_GALLERY", entityType: "GalleryImage", entityId: id, oldValue: { url: prev.url, category: prev.category }, newValue: { deleted: true }, ipAddress: actor.ipAddress ?? null });
}
