import "server-only";
import { prisma } from "@/lib/db/prisma";
import { publicEnv } from "@/lib/env";
import { AppError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { sendEmail } from "@/lib/email/service";
import { resetPasswordTemplate, verifyEmailTemplate } from "@/lib/email/templates";
import { emailBranding as branding } from "@/lib/email/branding";
import { logger } from "@/lib/logger";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import { createSession, destroySession, revokeAllSessions, type SessionUser } from "./session";
import { generateToken, hashToken } from "./tokens";

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

const INVALID_CREDENTIALS = "Incorrect email or password.";

function toSessionUser(u: { id: string; email: string; name: string; phone: string | null; role: SessionUser["role"]; emailVerifiedAt: Date | null }): SessionUser {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, emailVerifiedAt: u.emailVerifiedAt };
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const [byEmail, byPhone] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } }),
  ]);
  if (byEmail) throw new ValidationError("An account with this email already exists.", { email: "Already registered" });
  if (byPhone) throw new ValidationError("An account with this phone number already exists.", { phone: "Already registered" });

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, phone: input.phone, passwordHash, role: "USER" },
  });

  // Fire-and-forget: registration must succeed even if email is not configured.
  void sendVerificationEmail(user.id).catch((err) => logger.warn("Verification email failed", { err }));

  await createSession(user.id);
  return toSessionUser(user);
}

export async function loginUser(input: LoginInput): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Always run a hash comparison so timing is uniform whether or not the account exists.
  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || user.deletedAt) throw new UnauthorizedError(INVALID_CREDENTIALS);
  if (!user.isActive) throw new AppError("FORBIDDEN", "This account has been deactivated. Please contact the property.", 403);

  await createSession(user.id);
  return toSessionUser(user);
}

export async function logoutUser(): Promise<void> {
  await destroySession();
}

export async function sendVerificationEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return;

  const raw = generateToken();
  await prisma.authToken.create({
    data: { userId, type: "EMAIL_VERIFICATION", tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS) },
  });
  const url = `${publicEnv.siteUrl}/verify-email?token=${encodeURIComponent(raw)}`;
  const tpl = verifyEmailTemplate(await branding(), { name: user.name, url });
  await sendEmail({ to: user.email, template: "verify-email", ...tpl });
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const token = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!token || token.type !== "EMAIL_VERIFICATION" || token.usedAt || token.expiresAt < new Date()) {
    throw new ValidationError("This verification link is invalid or has expired.");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
  ]);
}

/** Always resolves successfully to avoid leaking whether an email is registered. */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || user.deletedAt) return;

  // Invalidate earlier reset tokens.
  await prisma.authToken.updateMany({
    where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null },
    data: { usedAt: new Date() },
  });
  const raw = generateToken();
  await prisma.authToken.create({
    data: { userId: user.id, type: "PASSWORD_RESET", tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
  });
  const url = `${publicEnv.siteUrl}/reset-password?token=${encodeURIComponent(raw)}`;
  const tpl = resetPasswordTemplate(await branding(), { name: user.name, url });
  await sendEmail({ to: user.email, template: "reset-password", ...tpl });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const token = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!token || token.type !== "PASSWORD_RESET" || token.usedAt || token.expiresAt < new Date()) {
    throw new ValidationError("This reset link is invalid or has expired. Please request a new one.");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { passwordHash, emailVerifiedAt: { set: new Date() } } }),
    prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
  ]);
  await revokeAllSessions(token.userId);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError();
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new ValidationError("Your current password is incorrect.", { currentPassword: "Incorrect password" });
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}

export async function updateProfile(userId: string, data: { name: string; phone: string }): Promise<SessionUser> {
  const clash = await prisma.user.findFirst({ where: { phone: data.phone, id: { not: userId } }, select: { id: true } });
  if (clash) throw new ValidationError("This phone number is already in use.", { phone: "Already in use" });
  const user = await prisma.user.update({ where: { id: userId }, data });
  return toSessionUser(user);
}
