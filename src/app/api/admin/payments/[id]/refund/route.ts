import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { refundOnlinePayment } from "@/lib/payments/razorpay";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000).optional(),
  notes: z.string().trim().max(250).optional(),
});

/** POST /api/admin/payments/:id/refund — refund a Razorpay payment (full or partial). */
export const POST = handleRoute(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(req, bodySchema);
  const refundId = await refundOnlinePayment(id, admin.id, body.amount ?? null, body.notes ?? null);
  return ok({ refundId });
});
