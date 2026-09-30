"use client";

import { Eye, EyeOff, Loader2, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { GALLERY_CATEGORIES } from "@/lib/validation/admin";

export const GALLERY_CATEGORY_LABELS: Record<(typeof GALLERY_CATEGORIES)[number], string> = {
  ROOMS: "Rooms",
  PROPERTY: "Property",
  EXTERIOR: "Exterior",
  FACILITIES: "Facilities",
  NEARBY_ATTRACTIONS: "Nearby attractions",
  EVENTS: "Events",
};

type Img = { id: string; url: string; alt: string | null; caption: string | null; category: (typeof GALLERY_CATEGORIES)[number]; isFeatured: boolean; isPublished: boolean };

const selectCls = "h-11 rounded-lg border border-input bg-background px-3 text-sm";

export function GalleryManager({ images }: { images: Img[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [category, setCategory] = useState<Img["category"]>("PROPERTY");
  const [busy, setBusy] = useState<string | null>(null);

  async function upload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) { toast.error("Choose at least one image"); return; }
    setBusy("upload");
    let okCount = 0;
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("alt", alt);
        fd.set("category", category);
        const res = await fetch("/api/admin/gallery", { method: "POST", body: fd });
        const json = (await res.json()) as { ok: boolean; error?: { message: string; details?: Record<string, string> } };
        if (!res.ok || !json.ok) {
          toast.error(`${file.name}: ${json.error?.details ? Object.values(json.error.details)[0] : json.error?.message ?? "Upload failed"}`);
          continue;
        }
        okCount++;
      }
      if (okCount > 0) toast.success(`${okCount} photo${okCount === 1 ? "" : "s"} added`);
      if (fileRef.current) fileRef.current.value = "";
      setAlt("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, msg: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/admin/gallery/${id}`, { method: "PATCH", json: body });
      toast.success(msg);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this photo from the gallery? This cannot be undone.")) return;
    setBusy(id);
    try {
      await apiFetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
      toast.success("Photo removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Photos (JPEG/PNG/WebP, max 8 MB each)</span>
          <Input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="h-11" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Alt text</span>
          <Input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} className="h-11" placeholder="Describe the photo for screen readers" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as Img["category"])} className={selectCls}>
            {GALLERY_CATEGORIES.map((c) => <option key={c} value={c}>{GALLERY_CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <Button type="button" onClick={upload} disabled={busy === "upload"} className="h-11">{busy === "upload" ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} Upload</Button>
      </div>

      {images.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">No gallery photos yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((img) => (
            <li key={img.id} className={`relative overflow-hidden rounded-xl border bg-card ${img.isPublished ? "" : "opacity-60"}`}>
              <div className="relative aspect-[4/3]"><Image src={img.url} alt={img.alt ?? ""} fill sizes="240px" className="object-cover" /></div>
              {img.isFeatured && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">Featured</span>}
              <div className="space-y-2 p-2">
                <select value={img.category} onChange={(e) => patch(img.id, { category: e.target.value }, "Category updated")} disabled={busy === img.id} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" aria-label="Category">
                  {GALLERY_CATEGORIES.map((c) => <option key={c} value={c}>{GALLERY_CATEGORY_LABELS[c]}</option>)}
                </select>
                <div className="flex items-center justify-between gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={img.isFeatured ? "Unfeature" : "Feature on home page"} onClick={() => patch(img.id, { isFeatured: !img.isFeatured }, img.isFeatured ? "Removed from featured" : "Featured")} disabled={busy === img.id}><Star className={img.isFeatured ? "fill-current" : ""} aria-hidden /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={img.isPublished ? "Hide" : "Publish"} onClick={() => patch(img.id, { isPublished: !img.isPublished }, img.isPublished ? "Hidden" : "Published")} disabled={busy === img.id}>{img.isPublished ? <Eye aria-hidden /> : <EyeOff aria-hidden />}</Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Remove photo" onClick={() => remove(img.id)} disabled={busy === img.id}><Trash2 aria-hidden /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
