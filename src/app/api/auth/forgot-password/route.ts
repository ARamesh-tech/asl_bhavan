import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { requestPasswordReset } from "@/lib/auth/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export const POST = handleRoute(async (req: NextRequest) => {
  enforceRateLimit("forgotPassword", clientIp(req));
  const { email } = await parseBody(req, forgotPasswordSchema);
  await requestPasswordReset(email);
  // Same response whether or not the account exists.
  return ok({ message: "If an account exists for that email, a reset link has been sent." });
});
