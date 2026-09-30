import type { NextRequest } from "next/server";
import { handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/guards";
import { updateProfile } from "@/lib/auth/service";
import { updateProfileSchema } from "@/lib/validation/auth";

export const PATCH = handleRoute(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await parseBody(req, updateProfileSchema);
  const updated = await updateProfile(user.id, body);
  return ok({ user: updated });
});
