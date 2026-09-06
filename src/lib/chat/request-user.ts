import { auth, authConfigured } from "@/lib/auth/server";
import { gateIdentityEnabled } from "@/lib/auth/gate-identity.server";
import { DEV_USER_ID } from "@/lib/auth/verify.server";

export async function userFromRequest(request: Request) {
  if (authConfigured || gateIdentityEnabled()) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user) return { id: session.user.id, email: session.user.email ?? null };
    return null;
  }
  return { id: DEV_USER_ID, email: "dev@example.com" };
}
