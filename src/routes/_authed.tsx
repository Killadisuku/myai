import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthGate } from "@/components/app/auth-gate";
import { AppShell } from "@/components/app/app-shell";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id } : null;
});

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => ({ sessionUser: await fetchSessionUser() }),
  component: AuthedLayout,
});

function AuthedLayout() {
  const { sessionUser } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeId = pathname.startsWith("/c/") ? pathname.slice(3).split("/")[0] : undefined;
  return (
    <AuthGate ssrUser={sessionUser}>
      <AppShell activeId={activeId}>
        <Outlet />
      </AppShell>
    </AuthGate>
  );
}
