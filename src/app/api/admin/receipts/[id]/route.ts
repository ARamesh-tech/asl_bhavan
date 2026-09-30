import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { emailReceipt, regenerateReceipt } from "@/lib/receipts/service";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ action: z.enum(["EMAIL", "REGENERATE"]) });

/** POST /api/admin/receipts/:id — EMAIL (send to guest) or REGENERATE (re-render PDF). */
export const POST = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, bodySchema);
  const ipRaw = clientIp(req);
  const ipAddress = ipRaw === "unknown" ? null : ipRaw;

  if (body.action === "EMAIL") {
    const result = await emailReceipt(id, { adminUserId: admin.id, ipAddress });
    return ok({ email: result });
  }
  const receipt = await regenerateReceipt(id, admin.id, ipAddress);
  return ok({ receipt: { id: receipt.id, receiptNumber: receipt.receiptNumber, lastGeneratedAt: receipt.lastGeneratedAt } });
});
