import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function SectionHeading({ eyebrow, title, href, linkLabel, description }: { eyebrow?: string; title: string; href?: string; linkLabel?: string; description?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>}
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {href && (
        <Button asChild variant="link" className="px-0 text-base">
          <Link href={href}>{linkLabel ?? "View all"} <ArrowRight aria-hidden /></Link>
        </Button>
      )}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed bg-card/60 p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="border-b bg-sand">
      <div className="container-page py-12 md:py-16">
        {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl md:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-muted-foreground sm:text-lg">{description}</p>}
        {children}
      </div>
    </section>
  );
}
