import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/my-bookings", "/profile", "/book/", "/booking/"] }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
