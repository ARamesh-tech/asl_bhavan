import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-constants";

/**
 * Optimistic route guard (Next.js 16 `proxy`).
 *
 * This only checks for the PRESENCE of the session cookie so anonymous users get a fast
 * redirect to /login. It is NOT the security boundary — every admin/customer layout, page,
 * server action and API route verifies the session against the database via
 * `src/lib/auth/guards.ts`.
 */

const CUSTOMER_PREFIXES = ["/my-bookings", "/profile"];
const ADMIN_PREFIX = "/admin";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const needsAuth =
    pathname === ADMIN_PREFIX ||
    pathname.startsWith(`${ADMIN_PREFIX}/`) ||
    CUSTOMER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (needsAuth && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  // Security headers on every response (CSP is set in next.config.ts).
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: [
    // Skip static assets and Next internals
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|uploads/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)",
  ],
};
