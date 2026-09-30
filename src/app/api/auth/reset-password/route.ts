import type { NextRequest } from "next/server";
import { clientIp, handleRoute, ok, parseBody } from "@/lib/api/respond";
import { resetPassword } from "@/lib/auth/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validation/auth";

export const POST = handleRoute(async (req: NextRequest) => {
  enforceRateLimit("forgotPassword", clientIp(req));
  const { token, password } = await parseBody(req, resetPasswordSchema);
  await resetPassword(token, password);
  return ok({ message: "Your password has been updated. Please sign in." });
});
