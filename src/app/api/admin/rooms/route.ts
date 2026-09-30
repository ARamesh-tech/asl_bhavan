import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/auth/guards";
import { upsertRoom } from "@/lib/admin/rooms-service";
import { roomUpsertSchema } from "@/lib/validation/admin";

export const POST = handleRoute(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const body = await parseBody(req, roomUpsertSchema);
  const ip = clientIp(req);
  const room = await upsertRoom(null, body, { adminUserId: admin.id, ipAddress: ip === "unknown" ? null : ip });
  return ok({ id: room.id, slug: room.slug }, { status: 201 });
});
