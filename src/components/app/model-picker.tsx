import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { ModelInfo } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function ModelPicker({
  models,
  value,
  onChange,
  align = "start",
}: {
  models: ModelInfo[];
  value: string;
  onChange: (slug: string) => void;
  align?: "start" | "end";
}) {
  const selected = models.find((m) => m.slug === value);
  const grouped = groupByProvider(models);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 max-w-44 items-center gap-1 rounded-xl px-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <span className="truncate">{selected?.name || value || "Select model"}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-80 w-80 overflow-y-auto">
        {grouped.map(([provider, list]) => (
          <div key={provider}>
            <DropdownMenuLabel>{provider}</DropdownMenuLabel>
            {list.map((m) => (
              <DropdownMenuItem
                key={m.slug}
                onSelect={() => onChange(m.slug)}
                className={cn("items-start", m.slug === value && "bg-secondary")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">{m.name}</span>
                    {m.promotional && <Badge variant="accent">Free</Badge>}
                    {!m.available && <Badge>Unavailable</Badge>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.supportsVision ? "Vision · " : ""}
                    {m.contextWindow ? `${formatTokens(m.contextWindow)} ctx` : "Context unknown"}
                    {m.pricing.inputPerMillion != null
                      ? ` · $${m.pricing.inputPerMillion}/M in`
                      : ""}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
        {models.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground">No models loaded.</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function groupByProvider(models: ModelInfo[]) {
  const map = new Map<string, ModelInfo[]>();
  for (const m of models) {
    const list = map.get(m.provider) ?? [];
    list.push(m);
    map.set(m.provider, list);
  }
  return [...map.entries()];
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}
