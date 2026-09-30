"use client";

import {
  BedDouble,
  CalendarDays,
  CalendarRange,
  BarChart3,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileText,
  Images,
  LayoutDashboard,
  Mail,
  Menu,
  MessageSquare,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { InstagramIcon } from "@/components/icons/instagram";
import { BrandMark } from "@/components/layout/brand-mark";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "cn";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

type IconComponent = LucideIcon | typeof InstagramIcon;

const ICONS = {
  dashboard: LayoutDashboard,
  calendar: CalendarDays,
  bookings: ClipboardList,
  rooms: BedDouble,
  availability: CalendarRange,
  payments: CreditCard,
  receipts: FileText,
  emails: Mail,
  posts: InstagramIcon,
  gallery: Images,
  reports: BarChart3,
  users: Users,
  messages: MessageSquare,
  settings: Settings,
  audit: ScrollText,
} satisfies Record<string, IconComponent>;

export type AdminNavSpec = Array<{ href: string; label: string; icon: keyof typeof ICONS; badge?: number }>;

function NavLinks({ items, onNavigate }: { items: AdminNavSpec; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className={cn("rounded-full px-1.5 text-xs font-semibold", active ? "bg-white/20" : "bg-brand-soft text-brand-deep")}>{item.badge}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebar({ items, propertyName }: { items: AdminNavSpec; propertyName: string }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-5"><BrandMark name={propertyName} /></div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto p-3"><NavLinks items={items} /></nav>
      <div className="border-t p-3">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="size-4" aria-hidden /> View website</Link>
      </div>
    </aside>
  );
}

export function AdminTopbar({ items, user, propertyName }: { items: AdminNavSpec; user: { name: string; email: string }; propertyName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open admin menu"><Menu aria-hidden /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b p-4"><SheetTitle asChild><div><BrandMark name={propertyName} /></div></SheetTitle></SheetHeader>
          <nav aria-label="Admin" className="p-3"><NavLinks items={items} onNavigate={() => setOpen(false)} /></nav>
        </SheetContent>
      </Sheet>
      <p className="text-sm font-medium text-muted-foreground lg:hidden">Admin</p>
      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link href="/admin/bookings/new">New booking</Link></Button>
        <UserMenu user={user} isAdmin />
      </div>
    </header>
  );
}
