import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Server-friendly pagination that preserves other query params. */
export function PaginationNav({
  page,
  totalPages,
  basePath,
  params = {},
  className = "",
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className={`flex items-center justify-between gap-3 ${className}`}>
      <Button asChild variant="outline" size="lg" disabled={page <= 1}>
        <Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}><ChevronLeft aria-hidden /> Previous</Link>
      </Button>
      <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
      <Button asChild variant="outline" size="lg" disabled={page >= totalPages}>
        <Link href={href(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined}>Next <ChevronRight aria-hidden /></Link>
      </Button>
    </nav>
  );
}
