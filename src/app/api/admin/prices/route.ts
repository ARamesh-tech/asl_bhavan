import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { upsertRoomPrice } from "@/lib/admin/rooms-service";
import { roomPriceSchema } from "@/lib/validation/admin";
import { cuidSchema } from "@/lib/validation/common";

const bodySchema = z.object({ id: cuidSchema.optional() }).and(roomPriceSchema);

export const POST = handleRoute(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const body = await parseBody(req, bodySchema);
  const ip = clientIp(req);
  const price = await upsertRoomPrice(
    { id: body.id, roomId: body.roomId, startDate: body.startDate, endDate: body.endDate, price: body.price, pricePerPerson: body.pricePerPerson ?? null, priority: body.priority, reason: body.reason ?? null },
    { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip },
  );
  return ok({ price: { ...price, price: price.price.toNumber(), pricePerPerson: price.pricePerPerson?.toNumber() ?? null } }, { status: 201 });
});
