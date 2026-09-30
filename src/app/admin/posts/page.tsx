import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Archive, ExternalLink, Eye, EyeOff, Pencil, Plus, RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { PaginationNav } from "@/components/layout/pagination-nav";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { integrations } from "@/lib/env";
import { cn } from "cn";

export const metadata: Metadata = { title: "Instagram posts" };
const PAGE_SIZE = 24;
const FILTERS = [
  { id: undefined, label: "All" },
  { id: "instagram", label: "From Instagram" },
  { id: "website", label: "Written here" },
  { id: "hidden", label: "Hidden" },
  { id: "archived", label: "Archived" },
] as const;

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.id === sp.filter)?.id;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.PostWhereInput =
    filter === "instagram" ? { source: "INSTAGRAM", isArchived: false }
    : filter === "website" ? { source: "WEBSITE", isArchived: false }
    : filter === "hidden" ? { isPublished: false, isArchived: false }
    : filter === "archived" ? { isArchived: true }
    : { isArchived: false };

  const [rows, total, lastSync] = await Promise.all([
    prisma.post.findMany({ where, orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.post.count({ where }),
    prisma.instagramSyncLog.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const instagram = integrations().instagram;

  return (
    <>
      <AdminPageHeader
        title="Instagram posts"
        description="Posts appear on the public Posts page and the home page. Sync pulls from your Instagram Business account via the official API."
        actions={
          <>
            {instagram ? (
              <ActionButton url="/api/admin/instagram/sync" successMessage="Instagram sync finished" variant="outline" size="default"><RefreshCw aria-hidden /> Sync Instagram</ActionButton>
            ) : (
              <span className="text-xs text-muted-foreground">Instagram API not configured</span>
            )}
            <Button asChild><Link href="/admin/posts/new"><Plus aria-hidden /> New post</Link></Button>
          </>
        }
      />

      {lastSync && (
        <p className="mb-4 text-xs text-muted-foreground">
          Last sync {lastSync.startedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} · {lastSync.status.toLowerCase()} · fetched {lastSync.fetchedCount}, new {lastSync.createdCount}, updated {lastSync.updatedCount}
          {lastSync.error && <span className="block text-destructive">{lastSync.error}</span>}
        </p>
      )}

      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.label} href={f.id ? `/admin/posts?filter=${f.id}` : "/admin/posts"} aria-current={filter === f.id ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", filter === f.id ? "border-brand bg-brand text-white" : "hover:bg-muted")}>{f.label}</Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">No posts here yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((p) => (
            <li key={p.id} className={cn("flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft", !p.isPublished && "opacity-70")}>
              <div className="relative aspect-square bg-muted">
                {p.imageUrl ? <Image src={p.imageUrl} alt="" fill sizes="300px" className="object-cover" unoptimized={p.imageUrl.includes("cdninstagram")} /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>}
                <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-medium backdrop-blur">{p.source === "INSTAGRAM" ? "Instagram" : "Website"}</span>
                {!p.isPublished && <span className="absolute right-2 top-2 rounded-full bg-muted px-2 py-0.5 text-xs">hidden</span>}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.publishedAt ? p.publishedAt.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }) : "Unscheduled"}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                  <Button asChild variant="ghost" size="icon-sm" aria-label="Edit"><Link href={`/admin/posts/${p.id}`}><Pencil aria-hidden /></Link></Button>
                  {!p.isArchived && (
                    <ActionButton url={`/api/admin/posts/${p.id}`} method="PATCH" json={{ isPublished: !p.isPublished }} successMessage={p.isPublished ? "Post hidden" : "Post published"} variant="ghost" size="icon-sm">{p.isPublished ? <EyeOff aria-hidden /> : <Eye aria-hidden />}</ActionButton>
                  )}
                  <ActionButton url={`/api/admin/posts/${p.id}`} method="PATCH" json={{ isArchived: !p.isArchived, ...(p.isArchived ? {} : { isPublished: false }) }} successMessage={p.isArchived ? "Post restored" : "Post archived"} variant="ghost" size="icon-sm"><Archive aria-hidden /></ActionButton>
                  {p.instagramUrl && <Button asChild variant="ghost" size="icon-sm" aria-label="Open on Instagram"><a href={p.instagramUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /></a></Button>}
                  <span className="ml-auto"><DeleteButton url={`/api/admin/posts/${p.id}`} title={p.source === "INSTAGRAM" ? "Archive this Instagram post?" : "Delete this post?"} description={p.source === "INSTAGRAM" ? "Instagram posts are archived (not deleted) so a future sync doesn't bring them back." : "This permanently removes the post and its image."} label={p.source === "INSTAGRAM" ? "Archive" : "Delete"} size="icon-sm" /></span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <PaginationNav page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} basePath="/admin/posts" params={{ filter }} className="mt-6" />
    </>
  );
}
