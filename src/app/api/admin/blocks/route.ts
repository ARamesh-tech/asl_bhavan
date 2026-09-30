import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { createRoomBlock } from "@/lib/admin/rooms-service";
import { roomBlockSchema } from "@/lib/validation/admin";

export const POST = handleRoute(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const body = await parseBody(req, roomBlockSchema);
  const ip = clientIp(req);
  const block = await createRoomBlock(
    { roomId: body.roomId, startDate: body.startDate, endDate: body.endDate, type: body.type, reason: body.reason ?? null, bedsBlocked: body.bedsBlocked ?? null },
    { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip },
  );
  return ok({ block }, { status: 201 });
});
