import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";
import { publicEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings/service";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const heading = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { property, content } = await getSettings();
  const title = property.name;
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${title} · ${property.tagline}`, template: `%s · ${title}` },
    description: content.seoDescription,
    applicationName: title,
    icons: property.faviconUrl ? { icon: property.faviconUrl } : undefined,
    openGraph: {
      type: "website",
      siteName: title,
      title: `${title} · ${property.tagline}`,
      description: content.seoDescription,
      locale: "en_IN",
      ...(content.heroImageUrl ? { images: [{ url: content.heroImageUrl }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description: content.seoDescription },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${heading.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </QueryProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
