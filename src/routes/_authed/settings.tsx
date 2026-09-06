import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAppData, type AppShellView } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ModelPicker } from "@/components/app/model-picker";
import { getUsageFn, saveSettingsFn } from "@/lib/chat/fns";
import { storeTheme, type ThemePref } from "@/lib/theme";
import { authClient } from "@/lib/auth/client";
import { Input } from "@/components/ui/input";
import { Menu } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/settings")({ component: SettingsPage });

function SettingsPage() {
  const data = useAppData();
  return <SettingsBody data={data} />;
}

function SettingsBody({ data }: { data: AppShellView }) {
  const [instructions, setInstructions] = useState(data.settings.customInstructions);
  const [temperature, setTemperature] = useState(data.settings.temperature);
  const [sendOnEnter, setSendOnEnter] = useState(data.settings.sendOnEnter);
  const [theme, setTheme] = useState<ThemePref>(data.settings.theme);
  const [defaultModel, setDefaultModel] = useState(data.settings.defaultModel || data.defaultModel);
  const [usage, setUsage] = useState<{ requests: number; promptTokens: number; completionTokens: number } | null>(
    null,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    void getUsageFn().then(setUsage);
  }, []);

  async function save() {
    await saveSettingsFn({
      data: {
        customInstructions: instructions,
        temperature,
        sendOnEnter,
        theme,
        defaultModel,
      },
    });
    storeTheme(theme);
    data.refresh();
    toast.success("Settings saved");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:px-6">
        <Button size="icon" variant="ghost" className="md:hidden" onClick={data.openSidebar} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <h1 className="text-sm font-medium">Settings</h1>
      </header>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 md:px-6">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Default model</h2>
          <ModelPicker models={data.models} value={defaultModel} onChange={setDefaultModel} />
          {data.gatewayLabel && <p className="text-xs text-muted-foreground">Gateway: {data.gatewayLabel}</p>}
          {data.modelsError && <p className="text-sm text-destructive">{data.modelsError}</p>}
        </section>
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Custom instructions</h2>
          <p className="text-sm text-muted-foreground">
            Personal preferences sent with every conversation. The administrator system prompt stays server-side.
          </p>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="How should MyAI talk to you? Any constraints?"
            className="min-h-32"
          />
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Temperature</h2>
            <span className="text-sm tabular-nums text-muted-foreground">{temperature.toFixed(1)}</span>
          </div>
          <Slider
            min={0}
            max={2}
            step={0.1}
            value={[temperature]}
            onValueChange={(v) => setTemperature(v[0] ?? 0.7)}
          />
        </section>
        <section className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Enter to send</h2>
            <p className="text-sm text-muted-foreground">Shift+Enter always inserts a new line.</p>
          </div>
          <Switch checked={sendOnEnter} onCheckedChange={setSendOnEnter} />
        </section>
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Appearance</h2>
          <div className="flex gap-2">
            {(["dark", "light", "system"] as const).map((t) => (
              <Button key={t} variant={theme === t ? "default" : "outline"} onClick={() => setTheme(t)}>
                {t[0]!.toUpperCase() + t.slice(1)}
              </Button>
            ))}
          </div>
        </section>
        {usage && (
          <section className="space-y-1">
            <h2 className="text-base font-semibold">Usage</h2>
            <p className="text-sm text-muted-foreground">
              {usage.requests} requests · {usage.promptTokens} input tokens · {usage.completionTokens} output tokens
            </p>
          </section>
        )}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Change password</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cur">Current</Label>
              <Input
                id="cur"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">New</Label>
              <Input
                id="next"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              const { error } = await authClient.changePassword({
                currentPassword,
                newPassword,
              });
              if (error) toast.error(error.message);
              else {
                toast.success("Password updated");
                setCurrentPassword("");
                setNewPassword("");
              }
            }}
            disabled={!currentPassword || newPassword.length < 8}
          >
            Update password
          </Button>
        </section>
        <Button onClick={() => void save()}>Save settings</Button>
      </div>
    </div>
  );
}
