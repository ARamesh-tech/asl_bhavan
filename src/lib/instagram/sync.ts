import "server-only";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/prisma";
import { getEnv, integrations } from "@/lib/env";
import { IntegrationDisabledError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage";

/**
 * Instagram sync via the official Instagram Graph API (Business/Creator account linked to a
 * Facebook Page). No scraping. Requires INSTAGRAM_ACCESS_TOKEN (long-lived) and
 * INSTAGRAM_ACCOUNT_ID. Posts are deduplicated by `instagramPostId`; the media image is
 * copied into our object storage because Instagram CDN URLs expire.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

type Media = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

type MediaPage = { data: Media[]; paging?: { next?: string } };

async function fetchMedia(limit: number): Promise<Media[]> {
  const env = getEnv();
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  let url: string | undefined = `${GRAPH}/${env.INSTAGRAM_ACCOUNT_ID}/media?fields=${fields}&limit=${Math.min(limit, 50)}&access_token=${encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN!)}`;
  const out: Media[] = [];
  while (url && out.length < limit) {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Never surface the token; strip query strings from any echoed URLs.
      throw new Error(`Instagram API ${res.status}: ${text.replace(/access_token=[^&"\s]+/g, "access_token=***").slice(0, 300)}`);
    }
    const page = (await res.json()) as MediaPage;
    out.push(...page.data);
    url = page.paging?.next;
  }
  return out.slice(0, limit);
}

function slugify(input: string): string {
  return input.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "post";
}

function titleFromCaption(caption: string | undefined, ts: string): string {
  const firstLine = (caption ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const cleaned = firstLine.replace(/#[\w]+/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length >= 4) return cleaned.slice(0, 120);
  return `Instagram post · ${new Date(ts).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })}`;
}

async function mirrorImage(media: Media): Promise<{ url: string; key: string } | null> {
  const src = media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url;
  if (!src) return null;
  const res = await fetch(src, { cache: "no-store" });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 12 * 1024 * 1024) return null;
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const stored = await storage().put(`instagram/${media.id}.${ext}`, buf, type);
  return { url: stored.url, key: stored.key };
}

export type SyncResult = { logId: string; status: "SUCCESS" | "FAILED" | "SKIPPED"; fetched: number; created: number; updated: number; error?: string };

export async function syncInstagram(opts: { limit?: number; adminUserId?: string | null; ipAddress?: string | null; autoPublish?: boolean } = {}): Promise<SyncResult> {
  if (!integrations().instagram) throw new IntegrationDisabledError("Instagram sync");
  const limit = opts.limit ?? 30;
  const log = await prisma.instagramSyncLog.create({ data: { status: "RUNNING" } });
  let created = 0;
  let updated = 0;
  let fetched = 0;

  try {
    const media = await fetchMedia(limit);
    fetched = media.length;
    const existing = await prisma.post.findMany({ where: { instagramPostId: { in: media.map((m) => m.id) } }, select: { id: true, instagramPostId: true, caption: true, imageUrl: true, isArchived: true } });
    const byId = new Map(existing.map((e) => [e.instagramPostId!, e]));

    for (const m of media) {
      const prev = byId.get(m.id);
      if (prev) {
        // Refresh caption only; keep admin edits to title/publish state and never un-archive.
        if ((prev.caption ?? "") !== (m.caption ?? "") || !prev.imageUrl) {
          const img = !prev.imageUrl ? await mirrorImage(m).catch(() => null) : null;
          await prisma.post.update({ where: { id: prev.id }, data: { caption: m.caption ?? null, ...(img ? { imageUrl: img.url, imageStorageKey: img.key } : {}) } });
          updated++;
        }
        continue;
      }
      const img = await mirrorImage(m).catch((err) => {
        logger.warn("Instagram image mirror failed", { mediaId: m.id, err });
        return null;
      });
      const base = slugify(titleFromCaption(m.caption, m.timestamp));
      const slug = `${base}-${m.id.slice(-6)}`;
      await prisma.post.create({
        data: {
          title: titleFromCaption(m.caption, m.timestamp),
          slug,
          caption: m.caption ?? null,
          imageUrl: img?.url ?? m.media_url ?? m.thumbnail_url ?? null,
          imageStorageKey: img?.key ?? null,
          source: "INSTAGRAM",
          instagramPostId: m.id,
          instagramUrl: m.permalink,
          publishedAt: new Date(m.timestamp),
          isPublished: opts.autoPublish ?? true,
          createdById: opts.adminUserId ?? null,
        },
      });
      created++;
    }

    await prisma.instagramSyncLog.update({ where: { id: log.id }, data: { status: "SUCCESS", fetchedCount: fetched, createdCount: created, updatedCount: updated, finishedAt: new Date() } });
    if (opts.adminUserId) {
      await recordAudit({ adminUserId: opts.adminUserId, action: "ADMIN_SYNCED_INSTAGRAM", entityType: "InstagramSyncLog", entityId: log.id, newValue: { fetched, created, updated }, ipAddress: opts.ipAddress ?? null });
    }
    return { logId: log.id, status: "SUCCESS", fetched, created, updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.instagramSyncLog.update({ where: { id: log.id }, data: { status: "FAILED", fetchedCount: fetched, createdCount: created, updatedCount: updated, error: message.slice(0, 1000), finishedAt: new Date() } }).catch(() => undefined);
    logger.error("Instagram sync failed", { err: message });
    return { logId: log.id, status: "FAILED", fetched, created, updated, error: message };
  }
}
