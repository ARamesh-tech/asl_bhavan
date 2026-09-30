import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";

export function BrandMark({ name, logoUrl, className = "" }: { name: string; logoUrl?: string; className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`} aria-label={`${name} home`}>
      {logoUrl ? (
        <Image src={logoUrl} alt="" width={36} height={36} className="size-9 rounded-lg object-cover" />
      ) : (
        <span className="grid size-9 place-items-center rounded-lg bg-brand text-brand-foreground shadow-soft" aria-hidden>
          <Home className="size-5" />
        </span>
      )}
      <span className="font-heading text-lg font-semibold tracking-tight">{name}</span>
    </Link>
  );
}
