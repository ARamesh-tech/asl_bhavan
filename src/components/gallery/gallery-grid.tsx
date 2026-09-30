"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Img = { id: string; url: string; alt: string | null; caption: string | null; category: string };

export function GalleryGrid({ images }: { images: Img[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;
  const current = index !== null ? images[index] : undefined;

  const prev = useCallback(() => setIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length)), [images.length]);
  const next = useCallback(() => setIndex((i) => (i === null ? i : (i + 1) % images.length)), [images.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next]);

  return (
    <>
      <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>li]:mb-3 [&>li]:break-inside-avoid">
        {images.map((img, i) => (
          <li key={img.id}>
            <button type="button" onClick={() => setIndex(i)} className="group relative block w-full overflow-hidden rounded-xl bg-sand shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Open photo: ${img.caption ?? img.alt ?? img.category}`}>
              <Image src={img.url} alt={img.alt ?? img.caption ?? img.category} width={600} height={450} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              {img.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-left text-xs text-white">{img.caption}</span>}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent className="border-none bg-black/95 p-2 text-white ring-0 sm:max-w-5xl sm:p-4" showCloseButton={false}>
          <DialogTitle className="sr-only">Photo viewer</DialogTitle>
          {current && (
            <>
              <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
                <Image src={current.url} alt={current.alt ?? current.caption ?? current.category} fill sizes="100vw" className="object-contain" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                <p className="truncate text-white/80">{current.caption ?? current.category} · {index! + 1} / {images.length}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={prev} aria-label="Previous photo" className="text-white hover:bg-white/10 hover:text-white"><ChevronLeft /></Button>
                  <Button variant="ghost" size="icon" onClick={next} aria-label="Next photo" className="text-white hover:bg-white/10 hover:text-white"><ChevronRight /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setIndex(null)} aria-label="Close" className="text-white hover:bg-white/10 hover:text-white"><X /></Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
