import { createFileRoute } from "@tanstack/react-router";
import { resolveGateway } from "@/lib/ai/gateway";
import { dbSource } from "@/lib/db";

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () => {
        const database = dbSource === "neon";
        const ai = Boolean(resolveGateway());
        return Response.json({
          ok: true,
          ready: database && ai,
          database,
          ai,
        });
      },
    },
  },
});
