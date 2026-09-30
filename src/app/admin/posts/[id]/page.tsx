import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PostForm } from "@/components/admin/post-form";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) notFound();
  return (
    <>
      <Link href="/admin/posts" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> All posts</Link>
      <AdminPageHeader title="Edit post" description={post.source === "INSTAGRAM" ? "Synced from Instagram. Your edits to title and visibility are kept on future syncs." : undefined} />
      <PostForm
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          caption: post.caption ?? "",
          imageUrl: post.imageUrl ?? "",
          instagramUrl: post.instagramUrl ?? "",
          publishedAt: post.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : "",
          isPublished: post.isPublished,
          sortOrder: post.sortOrder,
          source: post.source,
        }}
      />
    </>
  );
}
