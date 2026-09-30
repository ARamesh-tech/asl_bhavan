"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type PostFormValues = {
  id?: string;
  title: string;
  slug: string;
  caption: string;
  imageUrl: string;
  instagramUrl: string;
  publishedAt: string;
  isPublished: boolean;
  sortOrder: number;
  source: "WEBSITE" | "INSTAGRAM";
};

function slugify(input: string): string {
  return input.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export function PostForm({ initial }: { initial?: PostFormValues }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const isInstagram = initial?.source === "INSTAGRAM";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    fd.set("isPublished", fd.get("isPublished") === "on" ? "true" : "false");
    try {
      const res = await fetch(initial?.id ? `/api/admin/posts/${initial.id}` : "/api/admin/posts", { method: initial?.id ? "PUT" : "POST", body: fd });
      const json = (await res.json()) as { ok: boolean; data?: { post: { id: string } }; error?: { message: string; details?: Record<string, string> } };
      if (!res.ok || !json.ok) {
        if (json.error?.details) setErrors(json.error.details);
        throw new Error(json.error?.details ? "Please fix the highlighted fields." : json.error?.message ?? "Save failed");
      }
      toast.success(initial ? "Post updated" : "Post created");
      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null);

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
        <div className="space-y-1.5">
          <Label htmlFor="post-title">Title</Label>
          <Input id="post-title" name="title" required maxLength={160} defaultValue={initial?.title ?? ""} onChange={(e) => { if (!slugTouched) setSlug(slugify(e.target.value)); }} />
          {err("title")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="post-slug">Slug</Label>
          <Input id="post-slug" name="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} className="font-mono" />
          <p className="text-xs text-muted-foreground">URL: /posts/{slug || "…"}</p>
          {err("slug")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="post-caption">Caption / body</Label>
          <Textarea id="post-caption" name="caption" rows={8} maxLength={5000} defaultValue={initial?.caption ?? ""} />
          {err("caption")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="post-instagram">Instagram link (optional)</Label>
            <Input id="post-instagram" name="instagramUrl" type="url" defaultValue={initial?.instagramUrl ?? ""} readOnly={isInstagram} />
            {err("instagramUrl")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-date">Publish date</Label>
            <Input id="post-date" name="publishedAt" type="date" defaultValue={initial?.publishedAt ?? new Date().toISOString().slice(0, 10)} />
            {err("publishedAt")}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
          <Label htmlFor="post-file">Image</Label>
          {initial?.imageUrl && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border"><Image src={initial.imageUrl} alt="" fill sizes="320px" className="object-cover" /></div>
          )}
          <Input id="post-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
          <p className="text-xs text-muted-foreground">JPEG/PNG/WebP up to 8 MB. Uploading replaces the current image.</p>
          {err("file")}
          <input type="hidden" name="imageUrl" value={initial?.imageUrl ?? ""} readOnly />
        </div>
        <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isPublished" defaultChecked={initial?.isPublished ?? true} /> Published (visible on the website)
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="post-order">Sort order</Label>
            <Input id="post-order" name="sortOrder" type="number" min={0} max={10000} defaultValue={initial?.sortOrder ?? 0} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="animate-spin" aria-hidden />} {initial ? "Save changes" : "Create post"}</Button>
        </div>
      </div>
    </form>
  );
}
