import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InstagramIcon as Instagram } from "@/components/icons/instagram";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function getPost(slug: string) {
  return prisma.post.findFirst({ where: { slug, isPublished: true, isArchived: false } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: "Post not found" };
  return { title: post.title, description: post.caption?.slice(0, 160), openGraph: post.imageUrl ? { images: [{ url: post.imageUrl }] } : undefined };
}

export default async function PostPage({ params }: Props) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const date = post.publishedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(post.publishedAt) : null;

  return (
    <article className="container-page max-w-3xl py-10 md:py-14">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-6"><Link href="/posts"><ArrowLeft aria-hidden /> All posts</Link></Button>
      {date && <p className="text-sm text-muted-foreground">{date}</p>}
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{post.title}</h1>
      {post.imageUrl && (
        <div className="relative mt-6 aspect-[4/3] overflow-hidden rounded-2xl bg-sand shadow-soft sm:aspect-[16/10]">
          <Image src={post.imageUrl} alt={post.title} fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
        </div>
      )}
      {post.caption && <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{post.caption}</p>}
      {post.source === "INSTAGRAM" && post.instagramUrl && (
        <Button asChild variant="outline" size="lg" className="mt-8"><a href={post.instagramUrl} target="_blank" rel="noopener noreferrer"><Instagram aria-hidden /> View on Instagram</a></Button>
      )}
    </article>
  );
}
