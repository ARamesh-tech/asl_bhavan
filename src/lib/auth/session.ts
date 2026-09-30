import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken, signValue, unsignValue } from "./tokens";
import { SESSION_COOKIE } from "./session-constants";

/**
 * DB-backed sessions.
 *
 * Cookie:  asl_session = sign(rawToken)      HttpOnly, Secure (prod), SameSite=Lax
 * DB:      Session.tokenHash = sha256(rawToken)
 *
 * Revocation is immediate (delete the row). Sessions slide: when less than half the
 * lifetime remains, expiry is extended on use.
 */

export { SESSION_COOKIE };
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  emailVerifiedAt: Date | null;
};

export type CurrentSession = {
  sessionId: string;
  user: SessionUser;
  expiresAt: Date;
};

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function requestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0]!.trim() : h.get("x-real-ip");
  return { ipAddress: ipAddress || null, userAgent: h.get("user-agent")?.slice(0, 255) ?? null };
}

export async function createSession(userId: string): Promise<void> {
  const raw = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const meta = await requestMeta();

  await prisma.session.create({
    data: { tokenHash: hashToken(raw), userId, expiresAt, ...meta },
  });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, signValue(raw), cookieOptions(expiresAt));
}

async function readRawToken(): Promise<string | null> {
  const jar = await cookies();
  const signed = jar.get(SESSION_COOKIE)?.value;
  if (!signed) return null;
  return unsignValue(signed);
}

/**
 * Resolve the current session (memoised per request). Returns null for anonymous, expired,
 * revoked, or deactivated users. Never throws for auth reasons.
 */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const raw = await readRawToken();
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: {
      user: {
        select: { id: true, email: true, name: true, phone: true, role: true, emailVerifiedAt: true, isActive: true, deletedAt: true },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || !session.user.isActive || session.user.deletedAt) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Sliding expiry (best-effort; cookie refresh only possible in Route Handlers/Actions).
  if (session.expiresAt.getTime() - Date.now() < SESSION_TTL_MS / 2) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt } }).catch(() => undefined);
    session.expiresAt = expiresAt;
    try {
      const jar = await cookies();
      jar.set(SESSION_COOKIE, signValue(raw), cookieOptions(expiresAt));
    } catch {
      // Read-only context (server component render) — extend on next mutation instead.
    }
  }

  const { id, email, name, phone, role, emailVerifiedAt } = session.user;
  return { sessionId: session.id, user: { id, email, name, phone, role, emailVerifiedAt }, expiresAt: session.expiresAt };
});

export async function destroySession(): Promise<void> {
  const raw = await readRawToken();
  if (raw) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Log a user out of every device (after password reset / admin deactivation). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Housekeeping: remove expired sessions and used/expired auth tokens. */
export async function purgeExpiredSessions(): Promise<number> {
  const now = new Date();
  const [s, t] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
  ]);
  return s.count + t.count;
}
