import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getSession, type SessionUser } from "./session";

/**
 * Authorization guards.
 *
 *  - `require*`  → for API routes / services: throw AppErrors (mapped to 401/403).
 *  - `*OrRedirect` → for pages/layouts: redirect to /login (or home for non-admins).
 *
 * `proxy.ts` only does an optimistic cookie check for UX; THESE are the real boundary and
 * must be called in every admin layout, page, server action and route handler.
 */

const ROLE_RANK: Record<Role, number> = { USER: 1, ADMIN: 100 };

export function hasRole(user: SessionUser | null | undefined, minimum: Role): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return hasRole(user, "ADMIN");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new ForbiddenError();
  return user;
}

export async function requireUserOrRedirect(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const qs = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${qs}`);
  }
  return user;
}

export async function requireAdminOrRedirect(nextPath = "/admin"): Promise<SessionUser> {
  const user = await requireUserOrRedirect(nextPath);
  if (!isAdmin(user)) redirect("/?error=forbidden");
  return user;
}
