"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, LayoutDashboard, LogIn, LogOut, Menu, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLogout } from "./user-menu";

type Item = { readonly href: string; readonly label: string };

export function MobileNav({
  items,
  user,
  isAdmin,
}: {
  items: readonly Item[];
  user: { name: string; email: string } | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { logout, pending } = useLogout();

  const linkClass = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
      pathname === href ? "bg-brand-soft text-brand-deep" : "hover:bg-muted"
    }`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon-lg" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="mt-2 flex flex-col gap-1 px-2">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Separator className="my-3" />
          {user ? (
            <>
              <div className="px-3 py-1 text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.name}</span>
              </div>
              {isAdmin && (
                <Link href="/admin" className={linkClass("/admin")} onClick={() => setOpen(false)}>
                  <LayoutDashboard className="size-5" /> Admin Dashboard
                </Link>
              )}
              <Link href="/my-bookings" className={linkClass("/my-bookings")} onClick={() => setOpen(false)}>
                <CalendarCheck className="size-5" /> My Bookings
              </Link>
              <Link href="/profile" className={linkClass("/profile")} onClick={() => setOpen(false)}>
                <UserRound className="size-5" /> My Profile
              </Link>
              <button type="button" className={linkClass("#logout")} onClick={() => void logout()} disabled={pending}>
                <LogOut className="size-5" /> {pending ? "Signing out…" : "Logout"}
              </button>
            </>
          ) : (
            <Link href="/login" className={linkClass("/login")} onClick={() => setOpen(false)}>
              <LogIn className="size-5" /> Login / Register
            </Link>
          )}
          <div className="mt-4 px-2">
            <Button asChild size="xl" className="w-full">
              <Link href="/availability" onClick={() => setOpen(false)}>Book Now</Link>
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
