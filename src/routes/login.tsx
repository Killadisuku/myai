import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthSplash, LoginScreen } from "@/components/app/login-screen";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <AuthSplash />;
  if (user) return <Navigate to="/" />;
  return <LoginScreen />;
}
