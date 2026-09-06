import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/chat/request-user";
import { listGatewayModels } from "@/lib/ai/models";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const result = await listGatewayModels();
        return Response.json({
          object: "list",
          gateway: result.gateway
            ? { kind: result.gateway.kind, label: result.gateway.label }
            : null,
          defaultModel: result.defaultModel,
          error: result.error ?? null,
          data: result.models.map((m) => ({
            id: m.slug,
            name: m.name,
            provider: m.provider,
            context_window: m.contextWindow,
            max_output_tokens: m.maxOutputTokens,
            input_capability: m.inputModalities,
            output_capability: m.outputModalities,
            supports_vision: m.supportsVision,
            available: m.available,
            promotional: m.promotional,
            pricing: m.pricing,
            status: m.status,
          })),
        });
      },
    },
  },
});
