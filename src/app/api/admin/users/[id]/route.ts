import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guards";
import { revokeAllSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";

const schema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

/** PATCH /api/admin/users/:id — change role or deactivate. Admins cannot demote/deactivate themselves. */
export const PATCH = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError("User not found.");
  if (id === admin.id && (body.role === "USER" || body.isActive === false)) {
    throw new ValidationError("You cannot remove your own admin access or deactivate yourself.");
  }
  if ((body.role === "USER" || body.isActive === false) && user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, deletedAt: null } });
    if (admins <= 1) throw new ValidationError("At least one active admin must remain.");
  }
  const updated = await prisma.user.update({ where: { id }, data: { role: body.role, isActive: body.isActive }, select: { id: true, email: true, name: true, role: true, isActive: true } });
  if (body.isActive === false || (body.role && body.role !== user.role)) await revokeAllSessions(id);
  const ip = clientIp(req);
  await recordAudit({ adminUserId: admin.id, action: "ADMIN_UPDATED_USER", entityType: "User", entityId: id, oldValue: { role: user.role, isActive: user.isActive }, newValue: { role: updated.role, isActive: updated.isActive }, ipAddress: ip === "unknown" ? null : ip });
  return ok({ user: updated });
});
