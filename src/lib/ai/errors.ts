type GatewayErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
    param?: string;
  };
  message?: string;
};

export function parseGatewayErrorBody(text: string): GatewayErrorBody {
  try {
    return JSON.parse(text) as GatewayErrorBody;
  } catch {
    return { message: text };
  }
}

export function humanizeGatewayError(status: number, body: GatewayErrorBody | string): string {
  const parsed = typeof body === "string" ? parseGatewayErrorBody(body) : body;
  const code = (parsed.error?.code ?? "").toLowerCase();
  const type = (parsed.error?.type ?? "").toLowerCase();
  const raw = (parsed.error?.message ?? parsed.message ?? "").toLowerCase();

  if (code === "invalid_key" || status === 401 || type.includes("auth")) {
    return "The AI service key is invalid or missing. Ask the administrator to check EXPLABS_API_KEY.";
  }
  if (code === "insufficient_quota" || raw.includes("insufficient") || raw.includes("credits") || raw.includes("quota")) {
    return "This workspace is out of credits for the selected model. Try a promotional model, or add credits.";
  }
  if (code === "model_not_granted" || code === "model_not_found" || status === 404 || raw.includes("model not found") || raw.includes("does not exist")) {
    return "That model is not available on this gateway. Pick another model from the list.";
  }
  if (code === "unavailable_route" || code === "gateway_overloaded" || status === 429) {
    return "The model provider is busy or rate-limited. Wait a moment, or switch models.";
  }
  if (code === "all_routes_failed" || status === 502) {
    return "Every provider for this model failed. Try a different model.";
  }
  if (code === "deadline_exceeded" || status === 504 || raw.includes("timeout")) {
    return "The model took too long to respond. Try a shorter prompt, or another model.";
  }
  if (code === "unsupported_capability" || raw.includes("vision") || raw.includes("image")) {
    return "This model does not support that input. Choose a vision-capable model for images.";
  }
  if (code === "unsupported_parameter" || code === "invalid_parameter") {
    return "This model rejected one of the generation settings. Try again without custom temperature.";
  }
  if (code === "gateway_draining" || status === 503) {
    return "The AI gateway is temporarily unavailable. Please try again shortly.";
  }
  if (status >= 500) {
    return "The AI service had an internal error. Please try again.";
  }
  if (parsed.error?.message && !looksLikeSecret(parsed.error.message)) {
    return parsed.error.message;
  }
  return "The AI service returned an error. Please try again.";
}

function looksLikeSecret(text: string) {
  return /xpl_|xai-|sk-|api[_-]?key|bearer\s+[a-z0-9]/i.test(text);
}
