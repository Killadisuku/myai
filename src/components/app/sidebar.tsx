import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  Box,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { LogoMark, LogoWord } from "./logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { deleteConversationFn, renameConversationFn } from "@/lib/chat/fns";
import type { Conversation } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function Sidebar({
  conversations,
  activeId,
  onRefresh,
  onSearch,
  onNavigate,
}: {
  conversations: Conversation[];
  activeId?: string;
  onRefresh: () => void;
  onSearch: (q: string) => void;
  onNavigate?: () => void;
}) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const showSignOut = authEnabled && !hasGateSessionMarker();
  const groups = groupConversations(conversations);
  const deleteTitle = conversations.find((c) => c.id === deleteId)?.title;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <LogoMark className="size-8" />
        <LogoWord />
      </div>
      <div className="px-3 pb-2">
        <Button
          className="w-full justify-start gap-2"
          onClick={() => {
            onNavigate?.();
            void navigate({ to: "/" });
          }}
        >
          <Plus className="size-4" />
          New chat
        </Button>
      </div>
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            placeholder="Search chats"
            className="h-10 pl-9"
            onChange={(e) => {
              setQuery(e.target.value);
              onSearch(e.target.value);
            }}
          />
        </div>
      </div>
      <ScrollArea className="flex-1 px-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">No conversations yet.</p>
        ) : (
          <div className="space-y-4 pb-4">
            {groups.map(([label, items]) => (
              <div key={label}>
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((c) => (
                    <li key={c.id} className="group relative">
                      <Link
                        to="/c/$id"
                        params={{ id: c.id }}
                        onClick={onNavigate}
                        aria-current={activeId === c.id ? "page" : undefined}
                        className={cn(
                          "flex h-10 items-center rounded-[12px] px-3 pr-9 text-sm",
                          activeId === c.id ? "bg-secondary" : "hover:bg-secondary/70",
                        )}
                      >
                        <span className="truncate">{c.title || "New chat"}</span>
                      </Link>
                      <div className="absolute right-1 top-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-lg text-muted-foreground opacity-100 hover:bg-background md:opacity-0 md:group-hover:opacity-100"
                              aria-label="Conversation menu"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setRenameId(c.id);
                                setRenameValue(c.title);
                              }}
                            >
                              <Pencil className="size-3.5" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleteId(c.id)}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="mt-auto space-y-1 border-t border-border p-3">
        <NavLink to="/models" icon={<Box className="size-4" />} label="Models" onNavigate={onNavigate} />
        <NavLink to="/assistants" icon={<Bot className="size-4" />} label="Assistants" onNavigate={onNavigate} />
        <NavLink to="/settings" icon={<Settings className="size-4" />} label="Settings" onNavigate={onNavigate} />
        <div className="flex items-center gap-2 rounded-2xl px-2 py-2">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-medium">
              {(user?.displayName ?? user?.primaryEmail ?? "U").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.displayName ?? "Account"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.primaryEmail}</p>
          </div>
          {showSignOut && (
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
              aria-label="Sign out"
              onClick={() => void signOut("/login")}
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={Boolean(renameId)} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameId && renameValue.trim()) {
                void renameConversationFn({ data: { id: renameId, title: renameValue.trim() } }).then(() => {
                  setRenameId(null);
                  onRefresh();
                });
              }
            }}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!renameId || !renameValue.trim()) return;
                await renameConversationFn({ data: { id: renameId, title: renameValue.trim() } });
                setRenameId(null);
                onRefresh();
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete “{deleteTitle || "this chat"}”? This cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteId) return;
                const id = deleteId;
                await deleteConversationFn({ data: id });
                setDeleteId(null);
                onRefresh();
                if (activeId === id) void navigate({ to: "/" });
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NavLink({
  to,
  icon,
  label,
  onNavigate,
}: {
  to: "/models" | "/assistants" | "/settings";
  icon: ReactNode;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex h-10 items-center gap-2 rounded-[12px] px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}

function groupConversations(items: Conversation[]) {
  const order = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;
  const buckets: Record<(typeof order)[number], Conversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };
  const today = startOfLocalDay();
  const yesterday = today - 86_400_000;
  const week = today - 7 * 86_400_000;
  for (const c of items) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= today) buckets.Today.push(c);
    else if (t >= yesterday) buckets.Yesterday.push(c);
    else if (t >= week) buckets["Previous 7 days"].push(c);
    else buckets.Older.push(c);
  }
  return order.filter((k) => buckets[k].length > 0).map((k) => [k, buckets[k]] as const);
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
