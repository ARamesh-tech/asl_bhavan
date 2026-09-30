"use client";

import { Loader2, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

type Img = { id: string; url: string; alt: string | null; isPrimary: boolean };

export function RoomImagesManager({ roomId, images }: { roomId: string; images: Img[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Choose an image first"); return; }
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("alt", alt);
      const res = await fetch(`/api/admin/rooms/${roomId}/images`, { method: "POST", body: fd });
      const json = (await res.json()) as { ok: boolean; error?: { message: string; details?: Record<string, string> } };
      if (!res.ok || !json.ok) throw new Error(json.error?.details ? Object.values(json.error.details)[0] : json.error?.message ?? "Upload failed");
      toast.success("Photo added");
      if (fileRef.current) fileRef.current.value = "";
      setAlt("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, method: "PATCH" | "DELETE") {
    setBusy(id);
    try {
      await apiFetch(`/api/admin/room-images/${id}`, { method });
      toast.success(method === "DELETE" ? "Photo removed" : "Primary photo updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Photo (JPEG/PNG/WebP, max 8 MB)</span>
          <Input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="h-11" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Alt text (accessibility)</span>
          <Input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} className="h-11" placeholder="e.g. Deluxe room with double bed and balcony" />
        </label>
        <Button type="button" onClick={upload} disabled={busy === "upload"} className="h-11">{busy === "upload" ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} Upload</Button>
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet. The website shows a placeholder until you add one.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="group relative overflow-hidden rounded-xl border">
              <div className="relative aspect-[4/3]"><Image src={img.url} alt={img.alt ?? ""} fill sizes="240px" className="object-cover" /></div>
              {img.isPrimary && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">Primary</span>}
              <div className="flex items-center justify-between gap-1 p-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => act(img.id, "PATCH")} disabled={img.isPrimary || busy === img.id}><Star aria-hidden /> Primary</Button>
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Remove photo" onClick={() => act(img.id, "DELETE")} disabled={busy === img.id}><Trash2 aria-hidden /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
