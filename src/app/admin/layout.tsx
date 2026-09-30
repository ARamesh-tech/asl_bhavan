import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminSidebar, AdminTopbar, type AdminNavSpec } from "@/components/admin/admin-nav";
import { requireAdminOrRedirect } from "@/lib/auth/guards";
import { daysAgo } from "@/lib/booking/dates";
import { prisma } from "@/lib/db/prisma";
import { getSettingsGroup } from "@/lib/settings/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminOrRedirect();
  const [property, pendingConfirmations, newMessages, failedEmails] = await Promise.all([
    getSettingsGroup("property"),
    prisma.booking.count({ where: { status: "OWNER_CONFIRMATION", deletedAt: null } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.emailLog.count({ where: { status: "FAILED", createdAt: { gte: daysAgo(7) } } }),
  ]);

  const items: AdminNavSpec = [
    { href: "/admin", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
    { href: "/admin/bookings", label: "Bookings", icon: "bookings", badge: pendingConfirmations || undefined },
    { href: "/admin/rooms", label: "Rooms & pricing", icon: "rooms" },
    { href: "/admin/availability", label: "Blocks", icon: "availability" },
    { href: "/admin/payments", label: "Payments", icon: "payments" },
    { href: "/admin/receipts", label: "Receipts", icon: "receipts" },
    { href: "/admin/reports", label: "Reports", icon: "reports" },
    { href: "/admin/posts", label: "Instagram posts", icon: "posts" },
    { href: "/admin/gallery", label: "Gallery", icon: "gallery" },
    { href: "/admin/users", label: "Users & guests", icon: "users" },
    { href: "/admin/messages", label: "Messages", icon: "messages", badge: newMessages || undefined },
    { href: "/admin/emails", label: "Emails", icon: "emails", badge: failedEmails || undefined },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
    { href: "/admin/audit-logs", label: "Audit logs", icon: "audit" },
  ];

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar items={items} propertyName={property.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar items={items} user={{ name: user.name, email: user.email }} propertyName={property.name} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
