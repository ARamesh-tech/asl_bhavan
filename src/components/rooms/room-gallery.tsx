"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RoomImagePlaceholder } from "./room-image-placeholder";

type Img = { id: string; url: string; alt: string | null; caption: string | null };

export function RoomGallery({ images, roomName, type }: { images: Img[]; roomName: string; type: "PRIVATE_ROOM" | "DORMITORY" }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return <div className="aspect-[16/7] overflow-hidden rounded-2xl"><RoomImagePlaceholder type={type} /></div>;
  }

  const show = (i: number) => { setIndex(i); setOpen(true); };
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);
  const current = images[index]!;

  return (
    <>
      <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
        {images.slice(0, 5).map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => show(i)}
            className={`relative overflow-hidden rounded-xl bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 ${i === 0 ? "aspect-[16/10] md:col-span-2 md:row-span-2 md:aspect-auto" : "hidden aspect-[4/3] md:block"}`}
            aria-label={`Open photo ${i + 1} of ${images.length}`}
          >
            <Image src={img.url} alt={img.alt ?? `${roomName} photo ${i + 1}`} fill sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "25vw"} className="object-cover" priority={i === 0} />
            {i === 4 && images.length > 5 && (
              <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">+{images.length - 5} more</span>
            )}
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <Button variant="outline" size="sm" className="mt-2 md:hidden" onClick={() => show(0)}>View all {images.length} photos</Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-none bg-black/95 p-2 text-white ring-0 sm:max-w-5xl sm:p-4" showCloseButton={false}>
          <DialogTitle className="sr-only">{roomName} photos</DialogTitle>
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
            <Image src={current.url} alt={current.alt ?? `${roomName} photo ${index + 1}`} fill sizes="100vw" className="object-contain" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <p className="truncate text-white/80">{current.caption ?? `${index + 1} / ${images.length}`}</p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={prev} aria-label="Previous photo" className="text-white hover:bg-white/10 hover:text-white"><ChevronLeft /></Button>
              <Button variant="ghost" size="icon" onClick={next} aria-label="Next photo" className="text-white hover:bg-white/10 hover:text-white"><ChevronRight /></Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close" className="text-white hover:bg-white/10 hover:text-white"><X /></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
