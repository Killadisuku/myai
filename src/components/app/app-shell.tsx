import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getBootstrap, searchConversations } from "@/lib/chat/fns";
import { applyTheme, readStoredTheme, storeTheme } from "@/lib/theme";
import type { Conversation, CustomAssistant, ModelInfo, UserSettings } from "@/lib/chat/types";

export type AppData = {
  conversations: Conversation[];
  assistants: CustomAssistant[];
  models: ModelInfo[];
  settings: UserSettings;
  defaultModel: string;
  gatewayLabel: string | null;
  modelsError: string | null;
};

export type AppShellView = AppData & {
  refresh: () => void;
  openSidebar: () => void;
};

const AppDataContext = createContext<AppShellView | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppShell");
  return ctx;
}

export function AppShell({
  activeId,
  children,
}: {
  activeId?: string;
  children: ReactNode;
}) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      document.documentElement.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  const refresh = useCallback(() => {
    setError(null);
    void getBootstrap()
      .then((boot) => {
        setData({
          conversations: boot.conversations,
          assistants: boot.assistants,
          models: boot.models,
          settings: boot.settings,
          defaultModel: boot.defaultModel,
          gatewayLabel: boot.gatewayLabel,
          modelsError: boot.modelsError,
        });
        const pref = boot.settings.theme || readStoredTheme();
        storeTheme(pref);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load your workspace.");
      });
  }, []);

  useEffect(() => {
    applyTheme(readStoredTheme());
    refresh();
  }, [refresh]);

  const onSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        refresh();
        return;
      }
      void searchConversations({ data: q }).then((list) => {
        setData((prev) => (prev ? { ...prev, conversations: list } : prev));
      });
    },
    [refresh],
  );

  if (error && !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
        <div className="max-w-sm space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={refresh}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-dvh overflow-hidden bg-background">
        <aside className="hidden w-[272px] shrink-0 border-r border-sidebar-border bg-sidebar p-4 md:block">
          <Skeleton className="mb-4 h-8 w-24" />
          <Skeleton className="mb-3 h-10 w-full" />
          <Skeleton className="mb-3 h-10 w-full" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-5/6" />
            <Skeleton className="h-9 w-4/6" />
          </div>
        </aside>
        <main className="flex flex-1 flex-col">
          <div className="h-14 border-b border-border" />
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6">
            <Skeleton className="size-12 rounded-2xl" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
        </main>
      </div>
    );
  }

  const sidebar = (
    <Sidebar
      conversations={data.conversations}
      activeId={activeId}
      onRefresh={refresh}
      onSearch={onSearch}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <AppDataContext.Provider
      value={{
        ...data,
        refresh,
        openSidebar: () => setMobileOpen(true),
      }}
    >
      <div className="flex h-[var(--app-height,100dvh)] overflow-hidden bg-background">
        <aside className="hidden w-[272px] shrink-0 border-r border-sidebar-border md:block">{sidebar}</aside>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0">
            {sidebar}
          </SheetContent>
        </Sheet>
        {children}
      </div>
    </AppDataContext.Provider>
  );
}
