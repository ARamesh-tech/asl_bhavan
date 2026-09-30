import type { NextRequest } from "next/server";
import { handleRoute, ok, parseBody } from "@/lib/api/respond";
import { verifyEmail } from "@/lib/auth/service";
import { verifyEmailSchema } from "@/lib/validation/auth";

export const POST = handleRoute(async (req: NextRequest) => {
  const { token } = await parseBody(req, verifyEmailSchema);
  await verifyEmail(token);
  return ok({ verified: true });
});
