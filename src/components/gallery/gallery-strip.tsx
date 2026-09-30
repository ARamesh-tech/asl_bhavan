import Image from "next/image";
import Link from "next/link";

export type GalleryStripImage = { id: string; url: string; alt: string | null; caption: string | null };

export function GalleryStrip({ images }: { images: GalleryStripImage[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img, i) => (
        <li key={img.id} className={i === 0 ? "col-span-2 row-span-2" : ""}>
          <Link href="/gallery" className="group relative block aspect-square overflow-hidden rounded-xl bg-sand shadow-soft">
            <Image
              src={img.url}
              alt={img.alt ?? img.caption ?? "Property photo"}
              fill
              sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            {img.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-xs text-white">{img.caption}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
