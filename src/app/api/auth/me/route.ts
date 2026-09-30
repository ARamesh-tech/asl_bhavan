import { handleRoute, ok } from "@/lib/api/respond";
import { getCurrentUser } from "@/lib/auth/guards";

export const GET = handleRoute(async () => {
  const user = await getCurrentUser();
  return ok({ user });
});
