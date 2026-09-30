import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const [rooms, posts] = await Promise.all([
    prisma.room.findMany({ where: { isActive: true, deletedAt: null }, select: { slug: true, updatedAt: true } }).catch(() => []),
    prisma.post.findMany({ where: { isPublished: true, isArchived: false, source: "WEBSITE" }, select: { slug: true, updatedAt: true } }).catch(() => []),
  ]);
  const statics = ["", "/rooms", "/availability", "/gallery", "/about", "/posts", "/location", "/contact", "/policies"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: (p === "" || p === "/availability" ? "daily" : "weekly") as "daily" | "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
  return [
    ...statics,
    ...rooms.map((r) => ({ url: `${base}/rooms/${r.slug}`, lastModified: r.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${base}/posts/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
