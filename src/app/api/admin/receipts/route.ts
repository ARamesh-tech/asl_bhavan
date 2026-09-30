import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { issueReceipt } from "@/lib/receipts/service";
import { cuidSchema } from "@/lib/validation/common";

/** POST /api/admin/receipts — issue (or fetch existing) receipt for a booking. */
export const POST = handleRoute(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const body = await parseBody(req, z.object({ bookingId: cuidSchema }));
  const ip = clientIp(req);
  const receipt = await issueReceipt(body.bookingId, { generatedById: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok({ receipt: { id: receipt.id, receiptNumber: receipt.receiptNumber } }, { status: 201 });
});
