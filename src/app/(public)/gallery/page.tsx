import type { Metadata } from "next";
import Link from "next/link";
import { EmptyNote, PageHero } from "@/components/layout/section";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { prisma } from "@/lib/db/prisma";
import { getSettings } from "@/lib/settings/service";
import type { GalleryCategory } from "@/generated/prisma/client";
import { GALLERY_CATEGORY_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gallery" };

const CATEGORIES = Object.keys(GALLERY_CATEGORY_LABELS) as GalleryCategory[];

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const active = CATEGORIES.includes(category as GalleryCategory) ? (category as GalleryCategory) : null;
  const [{ property }, images, counts] = await Promise.all([
    getSettings(),
    prisma.galleryImage.findMany({ where: { isPublished: true, ...(active ? { category: active } : {}) }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.galleryImage.groupBy({ by: ["category"], where: { isPublished: true }, _count: { _all: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.category, c._count._all]));

  return (
    <>
      <PageHero eyebrow="Photos" title="Gallery" description={`A look around ${property.name}.`}>
        <nav aria-label="Gallery categories" className="mt-6 flex flex-wrap gap-2">
          <Link href="/gallery" className={`rounded-full border px-3 py-1.5 text-sm ${!active ? "bg-brand text-brand-foreground border-brand" : "bg-card hover:bg-muted"}`}>All</Link>
          {CATEGORIES.filter((c) => (countMap.get(c) ?? 0) > 0).map((c) => (
            <Link key={c} href={`/gallery?category=${c}`} className={`rounded-full border px-3 py-1.5 text-sm ${active === c ? "bg-brand text-brand-foreground border-brand" : "bg-card hover:bg-muted"}`} aria-current={active === c ? "page" : undefined}>
              {GALLERY_CATEGORY_LABELS[c]} <span className="text-xs opacity-70">({countMap.get(c)})</span>
            </Link>
          ))}
        </nav>
      </PageHero>
      <div className="container-page py-12">
        {images.length === 0 ? (
          <EmptyNote>No photos in this category yet.{property.instagramUrl && <> See more on <a href={property.instagramUrl} target="_blank" rel="noopener noreferrer" className="underline">Instagram</a>.</>}</EmptyNote>
        ) : (
          <GalleryGrid images={images.map((g) => ({ id: g.id, url: g.url, alt: g.alt, caption: g.caption, category: GALLERY_CATEGORY_LABELS[g.category] }))} />
        )}
      </div>
    </>
  );
}
