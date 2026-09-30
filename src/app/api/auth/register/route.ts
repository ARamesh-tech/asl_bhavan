import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { registerUser } from "@/lib/auth/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation/auth";

export const POST = handleRoute(async (req: NextRequest) => {
  enforceRateLimit("register", clientIp(req));
  const input = await parseBody(req, registerSchema);
  const user = await registerUser(input);
  return ok({ user }, { status: 201 });
});
