import Link from "next/link";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings/service";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { BrandMark } from "./brand-mark";

export const PUBLIC_NAV = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/availability", label: "Availability" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/posts", label: "Posts" },
  { href: "/location", label: "Location" },
  { href: "/contact", label: "Contact" },
] as const;

export async function SiteHeader() {
  const [{ property }, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const admin = isAdmin(user);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <BrandMark name={property.name} logoUrl={property.logoUrl} />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu user={{ name: user.name, email: user.email }} isAdmin={admin} />
          ) : (
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/login">Login</Link>
            </Button>
          )}
          <Button asChild size="lg" className="hidden sm:inline-flex">
            <Link href="/availability">Book Now</Link>
          </Button>
          <MobileNav
            items={PUBLIC_NAV}
            user={user ? { name: user.name, email: user.email } : null}
            isAdmin={admin}
          />
        </div>
      </div>
    </header>
  );
}
