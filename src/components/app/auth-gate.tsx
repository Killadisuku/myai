import type { ReactNode } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthSplash, LoginScreen } from "@/components/app/login-screen";

export function AuthGate({
  children,
  ssrUser = null,
}: {
  children: ReactNode;
  ssrUser?: { id: string } | null;
}) {
  const { user, isPending } = useCurrentUserState();
  const knownUser = user ?? (isPending ? ssrUser : null);
  if (knownUser) return <>{children}</>;
  if (isPending && ssrUser === undefined) return <AuthSplash />;
  return <LoginScreen />;
}
