import { Bot, BookOpen, Briefcase, ChevronDown, Code, Microscope, PenLine, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CustomAssistant } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const ICONS = {
  sparkles: Sparkles,
  code: Code,
  briefcase: Briefcase,
  book: BookOpen,
  microscope: Microscope,
  pen: PenLine,
} as const;

export function assistantIcon(avatar: string) {
  return ICONS[avatar as keyof typeof ICONS] ?? Bot;
}

export function AssistantPicker({
  assistants,
  value,
  onChange,
}: {
  assistants: CustomAssistant[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (assistants.length === 0) return null;
  const selected = assistants.find((a) => a.id === value);
  const Icon = selected ? assistantIcon(selected.avatar) : Bot;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 max-w-40 items-center gap-1 rounded-xl px-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Assistant"
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{selected?.name ?? "Default"}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onSelect={() => onChange(null)} className={cn(!value && "bg-secondary")}>
          Default
        </DropdownMenuItem>
        {assistants.map((a) => {
          const ItemIcon = assistantIcon(a.avatar);
          return (
            <DropdownMenuItem
              key={a.id}
              onSelect={() => onChange(a.id)}
              className={cn("items-start", a.id === value && "bg-secondary")}
            >
              <ItemIcon className="mt-0.5 size-3.5" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{a.name}</p>
                {a.description ? (
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{a.description}</p>
                ) : null}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
