import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import { messageStatusSchema } from "@/lib/validation/admin";

export const PATCH = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, messageStatusSchema);
  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Message not found.");
  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { status: body.status, adminNotes: body.adminNotes ?? existing.adminNotes, resolvedAt: body.status === "RESOLVED" ? existing.resolvedAt ?? new Date() : null },
  });
  const ip = clientIp(req);
  await recordAudit({ adminUserId: admin.id, action: "ADMIN_UPDATED_MESSAGE", entityType: "ContactMessage", entityId: id, oldValue: { status: existing.status }, newValue: { status: updated.status }, ipAddress: ip === "unknown" ? null : ip });
  return ok({ message: updated });
});
