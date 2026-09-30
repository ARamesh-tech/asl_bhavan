import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">404</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">The page you are looking for does not exist or may have moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="xl"><Link href="/">Go home</Link></Button>
        <Button asChild size="xl" variant="outline"><Link href="/rooms">Browse rooms</Link></Button>
      </div>
    </div>
  );
}
