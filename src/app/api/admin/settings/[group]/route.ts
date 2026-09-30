import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok } from "@/lib/api/respond";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guards";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { zodToFieldErrors } from "@/lib/api/respond";
import { settingsGroups, settingsSchemas, type SettingsGroup } from "@/lib/settings/definitions";
import { getSettingsGroup, updateSettingsGroup } from "@/lib/settings/service";
import { prisma } from "@/lib/db/prisma";

export const PUT = handleRoute(async (req: NextRequest, ctx: { params: Promise<{ group: string }> }) => {
  const admin = await requireAdmin();
  const { group } = await ctx.params;
  if (!(settingsGroups as readonly string[]).includes(group)) throw new NotFoundError("Unknown settings group.");
  const g = group as SettingsGroup;

  const json = await req.json().catch(() => null);
  if (!json || typeof json !== "object") throw new ValidationError("Invalid request body.");
  const parsed = settingsSchemas[g].partial().safeParse(json);
  if (!parsed.success) throw new ValidationError(undefined, zodToFieldErrors(parsed.error));

  const before = await getSettingsGroup(g, prisma);
  const after = await updateSettingsGroup(g, parsed.data as never, admin.id);
  const ip = clientIp(req);
  await recordAudit({ adminUserId: admin.id, action: "ADMIN_UPDATED_SETTINGS", entityType: "SiteSetting", entityId: g, oldValue: before, newValue: after, ipAddress: ip === "unknown" ? null : ip });
  return ok({ settings: after });
});
