import { handleRoute, ok } from "@/lib/api/respond";
import { logoutUser } from "@/lib/auth/service";

export const POST = handleRoute(async () => {
  await logoutUser();
  return ok({ loggedOut: true });
});
