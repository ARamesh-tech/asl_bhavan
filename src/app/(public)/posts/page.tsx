import type { Metadata } from "next";
import { InstagramIcon as Instagram } from "@/components/icons/instagram";
import { EmptyNote, PageHero } from "@/components/layout/section";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { getSettings } from "@/lib/settings/service";
import { PaginationNav } from "@/components/layout/pagination-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Posts", description: "News, updates and Instagram highlights." };

const PAGE_SIZE = 12;

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const where = { isPublished: true, isArchived: false } as const;
  const [{ property }, posts, total] = await Promise.all([
    getSettings(),
    prisma.post.findMany({ where, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.post.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHero eyebrow="Updates" title="Posts" description={`News and moments from ${property.name}.`}>
        {property.instagramUrl && (
          <Button asChild variant="outline" size="lg" className="mt-6"><a href={property.instagramUrl} target="_blank" rel="noopener noreferrer"><Instagram aria-hidden /> Follow on Instagram</a></Button>
        )}
      </PageHero>
      <div className="container-page py-12">
        {posts.length === 0 ? (
          <EmptyNote>No posts available yet.</EmptyNote>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => <PostCard key={p.id} post={{ id: p.id, slug: p.slug, title: p.title, caption: p.caption, imageUrl: p.imageUrl, source: p.source, instagramUrl: p.instagramUrl, publishedAt: p.publishedAt }} />)}
            </div>
            <PaginationNav page={page} totalPages={totalPages} basePath="/posts" className="mt-10" />
          </>
        )}
      </div>
    </>
  );
}
