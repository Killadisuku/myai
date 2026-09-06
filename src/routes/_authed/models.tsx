import { createFileRoute } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useAppData } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authed/models")({ component: ModelsPage });

function ModelsPage() {
  const data = useAppData();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:px-6">
        <Button size="icon" variant="ghost" className="md:hidden" onClick={data.openSidebar} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <h1 className="text-sm font-medium">Models</h1>
      </header>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
        <p className="mb-4 text-sm text-muted-foreground">
          Models are loaded from the AI gateway. Promotional and free models are marked.
          {data.gatewayLabel ? ` Currently routing through ${data.gatewayLabel}.` : ""}
        </p>
        {data.modelsError && <p className="mb-4 text-sm text-destructive">{data.modelsError}</p>}
        <div className="overflow-x-auto rounded-3xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Context</th>
                <th className="px-4 py-3 font-medium">Input</th>
                <th className="px-4 py-3 font-medium">Output</th>
                <th className="px-4 py-3 font-medium">Pricing</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => (
                <tr key={m.slug} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.slug}</div>
                  </td>
                  <td className="px-4 py-3">{m.provider}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {m.contextWindow ? m.contextWindow.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">{m.inputModalities.join(", ")}</td>
                  <td className="px-4 py-3">{m.outputModalities.join(", ")}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {m.pricing.inputPerMillion != null ? `$${m.pricing.inputPerMillion}/M in` : "—"}
                    {m.pricing.outputPerMillion != null ? ` · $${m.pricing.outputPerMillion}/M out` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.promotional && <Badge variant="accent">Free</Badge>}
                      <Badge variant={m.available ? "outline" : "default"}>
                        {m.available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                  </td>
                </tr>
              ))}
              {data.models.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No models returned by the gateway.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
