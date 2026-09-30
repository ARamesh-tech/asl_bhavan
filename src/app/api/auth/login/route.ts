import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { loginUser } from "@/lib/auth/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export const POST = handleRoute(async (req: NextRequest) => {
  const input = await parseBody(req, loginSchema);
  enforceRateLimit("login", `${clientIp(req)}:${input.email}`);
  const user = await loginUser(input);
  return ok({ user });
});
