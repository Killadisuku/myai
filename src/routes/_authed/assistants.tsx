import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Menu, Plus, Trash2 } from "lucide-react";
import { useAppData, type AppShellView } from "@/components/app/app-shell";
import { assistantIcon } from "@/components/app/assistant-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModelPicker } from "@/components/app/model-picker";
import { deleteAssistantFn, saveAssistantFn } from "@/lib/chat/fns";
import type { CustomAssistant } from "@/lib/chat/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/assistants")({ component: AssistantsPage });

const AVATARS = ["sparkles", "code", "briefcase", "book", "microscope", "pen"] as const;

function AssistantsPage() {
  const data = useAppData();
  return <AssistantsBody data={data} />;
}

function AssistantsBody({ data }: { data: AppShellView }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomAssistant | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:px-6">
        <Button size="icon" variant="ghost" className="md:hidden" onClick={data.openSidebar} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <h1 className="text-sm font-medium">Custom assistants</h1>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          New
        </Button>
      </header>
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-6 md:px-6">
        {data.assistants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Create a persona with its own instructions, model, and temperature. Examples: Programming Expert,
            Business Analyst, Technical Document Analyzer.
          </p>
        ) : (
          data.assistants.map((a) => {
            const Icon = assistantIcon(a.avatar);
            return (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-3xl border border-border bg-card p-4">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setEditing(a);
                    setOpen(true);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <p className="font-medium">{a.name}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.description || "No description"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {a.defaultModel || "Default model"}
                    {a.temperature != null ? ` · temp ${a.temperature}` : ""}
                  </p>
                </button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${a.name}`}
                  onClick={async () => {
                    await deleteAssistantFn({ data: a.id });
                    data.refresh();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
      <AssistantDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        models={data.models}
        defaultModel={data.defaultModel}
        onSaved={() => {
          setOpen(false);
          data.refresh();
        }}
      />
    </div>
  );
}

function AssistantDialog({
  open,
  onOpenChange,
  initial,
  models,
  defaultModel,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: CustomAssistant | null;
  models: Parameters<typeof ModelPicker>[0]["models"];
  defaultModel: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("sparkles");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(0.7);

  useReset(open, initial, defaultModel, setName, setDescription, setAvatar, setSystemPrompt, setModel, setTemperature);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit assistant" : "New assistant"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Programming Expert" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => {
                const Icon = assistantIcon(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs capitalize ${avatar === a ? "border-primary bg-secondary" : "border-border"}`}
                  >
                    <Icon className="size-3.5" />
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>System instruction</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are an expert software engineer..."
              className="min-h-32"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default model</Label>
            <ModelPicker models={models} value={model || defaultModel} onChange={(s) => setModel(s)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <Label>Temperature</Label>
              <span className="tabular-nums text-muted-foreground">{temperature.toFixed(1)}</span>
            </div>
            <Slider min={0} max={2} step={0.1} value={[temperature]} onValueChange={(v) => setTemperature(v[0] ?? 0.7)} />
          </div>
          <Button
            className="w-full"
            onClick={async () => {
              if (!name.trim()) return;
              await saveAssistantFn({
                data: {
                  id: initial?.id,
                  name: name.trim(),
                  description,
                  avatar,
                  systemPrompt,
                  defaultModel: model,
                  temperature,
                },
              });
              toast.success("Assistant saved");
              onSaved();
            }}
          >
            Save assistant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useReset(
  open: boolean,
  initial: CustomAssistant | null,
  defaultModel: string,
  setName: (v: string) => void,
  setDescription: (v: string) => void,
  setAvatar: (v: string) => void,
  setSystemPrompt: (v: string) => void,
  setModel: (v: string | null) => void,
  setTemperature: (v: number) => void,
) {
  const key = `${open}:${initial?.id ?? "new"}`;
  useStateKey(key, () => {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setAvatar(initial?.avatar ?? "sparkles");
    setSystemPrompt(initial?.systemPrompt ?? "");
    setModel(initial?.defaultModel ?? defaultModel);
    setTemperature(initial?.temperature ?? 0.7);
  });
}

function useStateKey(key: string, fn: () => void) {
  const [last, setLast] = useState("");
  if (last !== key) {
    setLast(key);
    fn();
  }
}
