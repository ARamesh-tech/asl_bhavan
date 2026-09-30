import type { Metadata } from "next";
import Link from "next/link";
import { GALLERY_CATEGORY_LABELS, GalleryManager } from "@/components/admin/gallery-manager";
import { AdminPageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/db/prisma";
import { GALLERY_CATEGORIES } from "@/lib/validation/admin";
import { cn } from "cn";

export const metadata: Metadata = { title: "Gallery" };

export default async function AdminGalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const category = GALLERY_CATEGORIES.find((c) => c === sp.category);
  const [images, counts] = await Promise.all([
    prisma.galleryImage.findMany({ where: category ? { category } : {}, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.galleryImage.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);
  const count = (c: string) => counts.find((x) => x.category === c)?._count._all ?? 0;

  return (
    <>
      <AdminPageHeader title="Gallery" description="Photos shown on the public Gallery page. Featured photos also appear on the home page." />
      <nav aria-label="Category" className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/gallery" aria-current={!category ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", !category ? "border-brand bg-brand text-white" : "hover:bg-muted")}>All ({images.length && !category ? images.length : counts.reduce((a, c) => a + c._count._all, 0)})</Link>
        {GALLERY_CATEGORIES.map((c) => (
          <Link key={c} href={`/admin/gallery?category=${c}`} aria-current={category === c ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", category === c ? "border-brand bg-brand text-white" : "hover:bg-muted")}>{GALLERY_CATEGORY_LABELS[c]} ({count(c)})</Link>
        ))}
      </nav>
      <GalleryManager images={images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, caption: i.caption, category: i.category, isFeatured: i.isFeatured, isPublished: i.isPublished }))} />
    </>
  );
}
