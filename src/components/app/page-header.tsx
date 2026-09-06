import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  subtitle,
  onOpenSidebar,
  children,
}: {
  title: string;
  subtitle?: string;
  onOpenSidebar: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 md:px-5">
      <Button size="icon" variant="ghost" className="md:hidden" onClick={onOpenSidebar} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </header>
  );
}
