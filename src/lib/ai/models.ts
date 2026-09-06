import { getSql } from "@/lib/db";
import {
  EXPLABS_CATALOG,
  getDefaultModelSlug,
  getFreeModelSlugs,
  readGatewayError,
  resolveGateway,
} from "./gateway";
import type { ModelInfo } from "@/lib/chat/types";

type CatalogModel = {
  model?: {
    slug?: string;
    display_name?: string;
    context_window?: number | null;
    max_output_tokens?: number | null;
    input_modalities?: string[];
    output_modalities?: string[];
    supported_params?: Record<string, boolean | undefined>;
    status?: string;
    maker?: string;
  };
  providers?: Array<{
    provider?: string;
    status?: string;
    routable?: boolean;
    requires_payment?: boolean;
    input_micro_usd_per_million?: number | null;
    output_micro_usd_per_million?: number | null;
  }>;
};

type OpenAiModel = {
  id: string;
  owned_by?: string;
  created?: number;
  context_length?: number;
};

const XAI_META: Record<
  string,
  { name: string; context: number; vision: boolean; provider: string }
> = {
  "grok-4.20": { name: "Grok 4.20", context: 1000000, vision: true, provider: "xAI" },
  "grok-4.5": { name: "Grok 4.5", context: 256000, vision: true, provider: "xAI" },
  "grok-4-1-fast-non-reasoning": {
    name: "Grok 4.1 Fast",
    context: 2000000,
    vision: true,
    provider: "xAI",
  },
  "grok-4-1-fast": { name: "Grok 4.1 Fast Reasoning", context: 2000000, vision: true, provider: "xAI" },
  "grok-4-1": { name: "Grok 4.1", context: 2000000, vision: true, provider: "xAI" },
  "grok-4": { name: "Grok 4", context: 256000, vision: true, provider: "xAI" },
  "grok-4-fast-non-reasoning": {
    name: "Grok 4 Fast (non-reasoning)",
    context: 256000,
    vision: true,
    provider: "xAI",
  },
  "grok-4-fast": { name: "Grok 4 Fast", context: 256000, vision: true, provider: "xAI" },
  "grok-3": { name: "Grok 3", context: 131072, vision: false, provider: "xAI" },
  "grok-3-mini": { name: "Grok 3 Mini", context: 131072, vision: false, provider: "xAI" },
  "grok-2-vision-1212": {
    name: "Grok 2 Vision",
    context: 32768,
    vision: true,
    provider: "xAI",
  },
  "grok-2-1212": { name: "Grok 2", context: 131072, vision: false, provider: "xAI" },
};

function lookupXaiMeta(id: string) {
  if (XAI_META[id]) return XAI_META[id];
  const key = Object.keys(XAI_META)
    .sort((a, b) => b.length - a.length)
    .find((k) => id.startsWith(k));
  return key ? XAI_META[key] : undefined;
}

function prettyName(slug: string) {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function providerFromSlug(slug: string, ownedBy?: string) {
  const s = slug.toLowerCase();
  if (ownedBy && ownedBy !== "exp" && ownedBy !== "openai") {
    return ownedBy;
  }
  if (s.includes("gpt") || s.includes("chatgpt") || s.startsWith("o1") || s.startsWith("o3") || s.startsWith("o4"))
    return "OpenAI";
  if (s.includes("claude") || s.includes("sonnet") || s.includes("opus") || s.includes("haiku") || s.includes("fable"))
    return "Anthropic";
  if (s.includes("gemini") || s.includes("gemma")) return "Google";
  if (s.includes("qwen")) return "Qwen";
  if (s.includes("deepseek")) return "DeepSeek";
  if (s.includes("grok")) return "xAI";
  if (s.includes("llama") || s.includes("meta")) return "Meta";
  if (s.includes("mistral") || s.includes("mixtral") || s.includes("codestral") || s.includes("pixtral"))
    return "Mistral";
  if (s.includes("kimi") || s.includes("moonshot")) return "Moonshot";
  if (s.includes("glm")) return "Zhipu";
  return ownedBy === "exp" ? "Experiential" : ownedBy || "Unknown";
}

function microToDollars(micro: number | null | undefined): number | null {
  if (micro == null || Number.isNaN(micro)) return null;
  return micro / 1_000_000;
}

export async function fetchPublicCatalog(): Promise<Map<string, CatalogModel>> {
  const map = new Map<string, CatalogModel>();
  try {
    const res = await fetch(EXPLABS_CATALOG, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return map;
    const json = (await res.json()) as { models?: CatalogModel[] } | CatalogModel[];
    const list = Array.isArray(json) ? json : (json.models ?? []);
    for (const entry of list) {
      const slug = entry.model?.slug;
      if (slug) map.set(slug, entry);
    }
  } catch {
    /* catalog is optional enrichment */
  }
  return map;
}

function fromCatalog(entry: CatalogModel, promotional: boolean, available: boolean): ModelInfo | null {
  const m = entry.model;
  if (!m?.slug) return null;
  const providers = entry.providers ?? [];
  const active = providers.find((p) => p.status === "active" && p.routable !== false) ?? providers[0];
  const input = m.input_modalities ?? ["text"];
  const output = m.output_modalities ?? ["text"];
  const priceIn = microToDollars(active?.input_micro_usd_per_million);
  const priceOut = microToDollars(active?.output_micro_usd_per_million);
  const isFree =
    promotional ||
    ((priceIn === 0 || priceIn == null) && (priceOut === 0 || priceOut == null) && active?.requires_payment === false);
  return {
    slug: m.slug,
    name: m.display_name || prettyName(m.slug),
    provider: providerFromSlug(m.slug, m.maker),
    contextWindow: m.context_window ?? null,
    maxOutputTokens: m.max_output_tokens ?? null,
    inputModalities: input,
    outputModalities: output,
    supportsVision: input.includes("image"),
    supportsTemperature: m.supported_params?.temperature !== false,
    available: available && (m.status ? m.status === "active" : true),
    promotional: isFree,
    pricing: { inputPerMillion: priceIn, outputPerMillion: priceOut },
    status: m.status || (available ? "active" : "unavailable"),
  };
}

function fromOpenAi(model: OpenAiModel, catalog: Map<string, CatalogModel>, free: Set<string>): ModelInfo {
  const cat = catalog.get(model.id);
  if (cat) {
    const info = fromCatalog(cat, free.has(model.id), true);
    if (info) return info;
  }
  const meta = lookupXaiMeta(model.id);
  const vision =
    meta?.vision ||
    /vision|image/i.test(model.id);
  return {
    slug: model.id,
    name: meta?.name || prettyName(model.id),
    provider: meta?.provider || providerFromSlug(model.id, model.owned_by),
    contextWindow: model.context_length ?? meta?.context ?? null,
    maxOutputTokens: null,
    inputModalities: vision ? ["text", "image"] : ["text"],
    outputModalities: ["text"],
    supportsVision: vision,
    supportsTemperature: true,
    available: true,
    promotional: free.has(model.id),
    pricing: { inputPerMillion: null, outputPerMillion: null },
    status: "active",
  };
}

async function cacheModels(models: ModelInfo[]) {
  try {
    const sql = await getSql();
    for (const m of models) {
      await sql`
        insert into models_cache (
          slug, display_name, provider, context_window, input_modalities, output_modalities,
          promotional, available, pricing_input, pricing_output, raw, updated_at
        ) values (
          ${m.slug}, ${m.name}, ${m.provider}, ${m.contextWindow},
          ${JSON.stringify(m.inputModalities)}, ${JSON.stringify(m.outputModalities)},
          ${m.promotional}, ${m.available},
          ${m.pricing.inputPerMillion == null ? null : String(m.pricing.inputPerMillion)},
          ${m.pricing.outputPerMillion == null ? null : String(m.pricing.outputPerMillion)},
          ${JSON.stringify(m)}, now()
        )
        on conflict (slug) do update set
          display_name = excluded.display_name,
          provider = excluded.provider,
          context_window = excluded.context_window,
          input_modalities = excluded.input_modalities,
          output_modalities = excluded.output_modalities,
          promotional = excluded.promotional,
          available = excluded.available,
          pricing_input = excluded.pricing_input,
          pricing_output = excluded.pricing_output,
          raw = excluded.raw,
          updated_at = now()
      `;
    }
  } catch {
    /* cache is best-effort */
  }
}

let cache:
  | {
      at: number;
      value: Awaited<ReturnType<typeof fetchLiveModels>>;
    }
  | null = null;

async function fetchLiveModels() {
  const gateway = resolveGateway();
  const free = new Set(getFreeModelSlugs());
  const catalog = await fetchPublicCatalog();

  if (!gateway) {
    const fallback = [...catalog.values()]
      .map((c) => fromCatalog(c, free.has(c.model?.slug ?? ""), false))
      .filter((m): m is ModelInfo => Boolean(m))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      models: fallback,
      gateway: null,
      defaultModel: getDefaultModelSlug() || fallback[0]?.slug || "",
      error: "AI is not available. Set EXPLABS_API_KEY on the server.",
    };
  }

  try {
    const res = await fetch(`${gateway.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${gateway.apiKey}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return {
        models: [],
        gateway,
        defaultModel: getDefaultModelSlug(),
        error: await readGatewayError(res),
      };
    }
    const json = (await res.json()) as { data?: OpenAiModel[] };
    const data = json.data ?? [];
    const granted = new Set(data.map((d) => d.id));
    const models = data.map((m) => {
      const info = fromOpenAi(m, catalog, free);
      if (free.has(info.slug)) info.promotional = true;
      return info;
    });

    for (const m of models) {
      if (free.has(m.slug)) m.promotional = true;
    }

    models.sort((a, b) => {
      if (a.promotional !== b.promotional) return a.promotional ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const chatModels = models.filter(isChatModel);

    void cacheModels(chatModels);

    const configured = getDefaultModelSlug();
    const defaultModel =
      (configured && granted.has(configured) ? configured : "") ||
      chatModels.find((m) => m.promotional)?.slug ||
      chatModels.find((m) => /grok-4/i.test(m.slug) && !/non-reasoning/i.test(m.slug))?.slug ||
      chatModels[0]?.slug ||
      configured;

    return { models: chatModels, gateway, defaultModel };
  } catch (err) {
    return {
      models: [],
      gateway,
      defaultModel: getDefaultModelSlug(),
      error: err instanceof Error ? err.message : "Could not reach the AI gateway.",
    };
  }
}

export async function listGatewayModels() {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const value = await fetchLiveModels();
  cache = { at: Date.now(), value };
  return value;
}

function isChatModel(m: ModelInfo) {
  const s = m.slug.toLowerCase();
  if (/(imagine|tts|embedding|whisper|moderation|video)/.test(s)) return false;
  return m.outputModalities.includes("text");
}

export function findModel(models: ModelInfo[], slug: string | null | undefined) {
  if (!slug) return undefined;
  return models.find((m) => m.slug === slug);
}
