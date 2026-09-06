import { humanizeGatewayError, parseGatewayErrorBody } from "./errors";

export type GatewayKind = "experiential" | "xai" | "vercel";

export type GatewayConfig = {
  kind: GatewayKind;
  baseUrl: string;
  apiKey: string;
  label: string;
};

const EXPLABS_BASE = "https://api.experientiallabs.ai/v1";
const EXPLABS_CATALOG = "https://api.experientiallabs.ai/api/models";
const XAI_BASE = "https://api.x.ai/v1";
const VERCEL_AI_BASE = "https://ai-gateway.vercel.sh/v1";

export function resolveGateway(): GatewayConfig | null {
  const explabs = process.env.EXPLABS_API_KEY?.trim();
  if (explabs) {
    return {
      kind: "experiential",
      baseUrl: EXPLABS_BASE,
      apiKey: explabs,
      label: "Experiential Labs",
    };
  }
  const xai =
    process.env.XAI_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    process.env.XAI_KEY?.trim();
  if (xai) {
    return {
      kind: "xai",
      baseUrl: XAI_BASE,
      apiKey: xai,
      label: "xAI",
    };
  }
  const vercelAi = process.env.AI_GATEWAY_API_KEY?.trim();
  if (vercelAi) {
    return {
      kind: "vercel",
      baseUrl: VERCEL_AI_BASE,
      apiKey: vercelAi,
      label: "Vercel AI Gateway",
    };
  }
  return null;
}

export function getAdminSystemPrompt() {
  return (
    process.env.SYSTEM_PROMPT?.trim() ||
    "You are MyAI, a capable personal assistant for coding, research, writing, analysis, and application development. Be precise, structured, and useful. Use markdown. When answering from attached documents, cite the source and page number when you have it (for example, \"According to page 17…\"). Do not claim you can override model-provider safety policies."
  );
}

export function getDefaultModelSlug() {
  return process.env.DEFAULT_MODEL?.trim() || "";
}

export function getFreeModelSlugs(): string[] {
  const raw =
    process.env.FREE_MODEL_SLUGS?.trim() ||
    process.env.PROMO_MODEL_SLUGS?.trim() ||
    "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function gatewayFetch(
  path: string,
  init: RequestInit & { gateway?: GatewayConfig } = {},
) {
  const gateway = init.gateway ?? resolveGateway();
  if (!gateway) {
    throw new GatewayUnavailableError("AI is not available in this environment.");
  }
  const { gateway: _ignored, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Authorization", `Bearer ${gateway.apiKey}`);
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }
  const url = path.startsWith("http") ? path : `${gateway.baseUrl}${path}`;
  const res = await fetch(url, { ...rest, headers });
  return { res, gateway };
}

export class GatewayUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayUnavailableError";
  }
}

export { EXPLABS_CATALOG, EXPLABS_BASE, XAI_BASE };

export async function readGatewayError(res: Response) {
  const text = await res.text().catch(() => "");
  return humanizeGatewayError(res.status, parseGatewayErrorBody(text));
}
