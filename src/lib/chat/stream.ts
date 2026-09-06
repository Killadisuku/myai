import { userFromRequest } from "./request-user";
import {
  getAdminSystemPrompt,
  gatewayKeyHint,
  readGatewayError,
  resolveGateway,
} from "@/lib/ai/gateway";
import { humanizeGatewayError } from "@/lib/ai/errors";
import { findModel, listGatewayModels } from "@/lib/ai/models";
import { retrieveChunks } from "@/lib/files/chunk";
import { decodeImageDataUrl, extractDocument, isAllowedFile, isImageMime } from "@/lib/files/extract";
import { truncate } from "@/lib/utils";
import * as db from "./db";
import type { ChatStreamEvent, MessageMetadata } from "./types";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 6;

export type ChatRequestBody = {
  conversationId?: string | null;
  content?: string;
  model?: string;
  assistantId?: string | null;
  temperature?: number | null;
  attachments?: Array<{ name: string; mime: string; dataBase64: string; size?: number }>;
  mode?: "send" | "regenerate" | "edit";
  targetMessageId?: string;
  editContent?: string;
};

type OpenAiMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

function sse(event: ChatStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function requireUser(request: Request) {
  const user = await userFromRequest(request);
  if (!user) throw new Error("Unauthorized");
  return user;
}

function titleFrom(text: string) {
  const t = truncate(text.replace(/\s+/g, " "), 56);
  return t || "New chat";
}

export async function handleChatRequest(request: Request): Promise<Response> {
  let user;
  try {
    user = await requireUser(request);
  } catch {
    return Response.json({ error: "Please sign in to chat." }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const gateway = resolveGateway();
  if (!gateway) {
    return Response.json(
      { error: gatewayKeyHint() || "AI is not available. Set XAI_API_KEY on the server." },
      { status: 503 },
    );
  }

  const mode = body.mode ?? "send";
  const userText = (mode === "edit" ? body.editContent : body.content)?.trim() ?? "";
  if (mode === "send" && !userText && !(body.attachments && body.attachments.length)) {
    return Response.json({ error: "Type a message or attach a file." }, { status: 400 });
  }

  const modelsResult = await listGatewayModels();
  const settings = await db.getSettings(user.id);
  const assistant = body.assistantId ? await db.getAssistant(user.id, body.assistantId) : null;

  const requestedModel =
    body.model ||
    assistant?.defaultModel ||
    settings.defaultModel ||
    modelsResult.defaultModel;
  if (!requestedModel) {
    return Response.json({ error: "No AI model is available." }, { status: 400 });
  }
  const modelInfo = findModel(modelsResult.models, requestedModel);
  const supportsVision = modelInfo?.supportsVision ?? /vision|image/i.test(requestedModel);
  const supportsTemperature = modelInfo?.supportsTemperature !== false;

  const incoming = body.attachments ?? [];
  if (incoming.length > MAX_FILES) {
    return Response.json({ error: "You can attach up to 6 files." }, { status: 400 });
  }

  const wantsImages = incoming.some(
    (f) => isImageMime(f.mime) || /\.(png|jpe?g|webp|gif)$/i.test(f.name),
  );
  if (wantsImages && !supportsVision && !userText) {
    return Response.json(
      {
        error: "This model does not support image input. Please select a vision-capable model.",
      },
      { status: 400 },
    );
  }

  let conversationId = body.conversationId ?? "";
  if (conversationId) {
    const existing = await db.getConversation(user.id, conversationId);
    if (!existing) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
  } else {
    const created = await db.createConversation(user.id, {
      title: titleFrom(userText || "New chat"),
      model: requestedModel,
      assistantId: assistant?.id ?? null,
    });
    conversationId = created.id;
  }

  let userMessageId = "";
  let promptForModel = userText;

  if (mode === "regenerate") {
    if (!body.targetMessageId) {
      return Response.json({ error: "Missing message to regenerate." }, { status: 400 });
    }
    const target = await db.getMessage(user.id, body.targetMessageId);
    if (!target || target.conversationId !== conversationId) {
      return Response.json({ error: "Message not found." }, { status: 404 });
    }
    await db.deleteMessagesAfter(user.id, conversationId, target.createdAt, target.id);
    const history = await db.listMessages(user.id, conversationId);
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    promptForModel = lastUser?.content ?? "";
    userMessageId = lastUser?.id ?? "";
  } else if (mode === "edit") {
    if (!body.targetMessageId || !userText) {
      return Response.json({ error: "Missing edited message." }, { status: 400 });
    }
    const target = await db.getMessage(user.id, body.targetMessageId);
    if (!target || target.conversationId !== conversationId || target.role !== "user") {
      return Response.json({ error: "Message not found." }, { status: 404 });
    }
    await db.updateMessage(user.id, target.id, {
      content: userText,
      metadata: { ...target.metadata, edited: true },
    });
    await db.deleteMessagesAfter(user.id, conversationId, target.createdAt);
    userMessageId = target.id;
    promptForModel = userText;
  } else {
    userMessageId = await db.insertMessage({
      userId: user.id,
      conversationId,
      role: "user",
      content: userText || "(attachment)",
      model: requestedModel,
    });
  }

  const imageParts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
  const savedAttachmentIds: string[] = [];
  const skippedFiles: string[] = [];
  let visionBlocked = false;

  for (const file of incoming) {
    if (!isAllowedFile(file.name, file.mime)) {
      skippedFiles.push(`${file.name} (unsupported type)`);
      continue;
    }
    const raw = file.dataBase64.includes(",") ? file.dataBase64.split(",").pop()! : file.dataBase64;
    const size = file.size || Math.ceil((raw.length * 3) / 4);
    if (size > MAX_FILE_BYTES) {
      skippedFiles.push(`${file.name} (over 4 MB)`);
      continue;
    }
    const extracted = await extractDocument(file.name, file.mime, file.dataBase64);
    const imageData = extracted.isImage ? decodeImageDataUrl(file.dataBase64, file.mime) : null;
    if (extracted.isImage) {
      if (!supportsVision) {
        visionBlocked = true;
      } else {
        imageParts.push({ type: "image_url", image_url: { url: imageData! } });
      }
    }
    const attId = await db.insertAttachment({
      userId: user.id,
      conversationId,
      messageId: userMessageId || null,
      filename: file.name.slice(0, 180),
      mime: file.mime || "application/octet-stream",
      sizeBytes: size,
      extractedText: extracted.text,
      pageCount: extracted.pageCount,
      imageData,
    });
    savedAttachmentIds.push(attId);
    if (extracted.chunks.length) {
      await db.insertChunks(user.id, conversationId, attId, extracted.chunks);
    }
  }

  if (savedAttachmentIds.length && userMessageId) {
    const msg = await db.getMessage(user.id, userMessageId);
    await db.updateMessage(user.id, userMessageId, {
      metadata: { ...msg?.metadata, attachmentIds: savedAttachmentIds },
    });
  }

  const chunks = await db.listChunks(user.id, conversationId);
  const retrieved = retrieveChunks(promptForModel, chunks.map((c) => ({
    content: c.content,
    pageNumber: c.page_number,
    filename: c.filename,
  })));

  const history = await db.listMessages(user.id, conversationId);
  const titleSeed = titleFrom(promptForModel || "New chat");
  const conv = await db.getConversation(user.id, conversationId);
  if (conv && (conv.title === "New chat" || !conv.title)) {
    await db.touchConversation(user.id, conversationId, { title: titleSeed, model: requestedModel });
  } else {
    await db.touchConversation(user.id, conversationId, { model: requestedModel });
  }

  const systemParts = [getAdminSystemPrompt()];
  if (assistant?.systemPrompt) {
    systemParts.push(`Custom assistant "${assistant.name}":\n${assistant.systemPrompt}`);
  }
  if (settings.customInstructions.trim()) {
    systemParts.push(`User preferences:\n${settings.customInstructions.trim()}`);
  }
  if (retrieved.length) {
    const ctx = retrieved
      .map((c) => {
        const loc = c.pageNumber ? ` (page ${c.pageNumber})` : "";
        const src = c.filename ? `Source: ${c.filename}${loc}` : loc ? `Source${loc}` : "Source";
        return `${src}\n${c.content}`;
      })
      .join("\n\n");
    systemParts.push(
      `Relevant excerpts from attached documents. Cite page numbers when present.\n\n${ctx}`,
    );
  }
  if (visionBlocked) {
    systemParts.push(
      "The user attached image(s), but the selected model cannot see images. Tell them clearly: This model does not support image input. Please select a vision-capable model.",
    );
  }
  if (skippedFiles.length) {
    systemParts.push(`These attachments were not processed: ${skippedFiles.join(", ")}. Mention this briefly if relevant.`);
  }

  const openaiMessages: OpenAiMessage[] = [{ role: "system", content: systemParts.join("\n\n") }];
  const historyForModel = history.filter((m) => m.role === "user" || m.role === "assistant");
  for (const m of historyForModel) {
    if (m.id === userMessageId) continue;
    openaiMessages.push({ role: m.role as "user" | "assistant", content: m.content });
  }

  const lastUserContent: OpenAiMessage =
    imageParts.length > 0
      ? {
          role: "user",
          content: [
            { type: "text", text: promptForModel || "Please analyze the attached image(s)." },
            ...imageParts,
          ],
        }
      : { role: "user", content: promptForModel };

  openaiMessages.push(lastUserContent);

  const temperature =
    typeof body.temperature === "number"
      ? body.temperature
      : assistant?.temperature ?? settings.temperature;

  const assistantMessageId = await db.insertMessage({
    userId: user.id,
    conversationId,
    role: "assistant",
    content: "",
    model: requestedModel,
    metadata: { status: "streaming" },
  });

  const payload: Record<string, unknown> = {
    model: requestedModel,
    messages: openaiMessages,
    stream: true,
    max_tokens: 8192,
  };
  if (supportsTemperature && typeof temperature === "number" && !Number.isNaN(temperature)) {
    payload.temperature = Math.min(2, Math.max(0, temperature));
  }

  const encoder = new TextEncoder();
  const abort = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(sse(event)));
      };
      send({
        type: "meta",
        conversationId,
        userMessageId,
        assistantMessageId,
        title: conv?.title && conv.title !== "New chat" ? conv.title : titleSeed,
        model: requestedModel,
      });

      let assembled = "";
      let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
      let stopped = false;
      let finished = false;

      const finish = async (status: MessageMetadata["status"], error?: string) => {
        if (finished) return;
        finished = true;
        const meta: MessageMetadata = { status, error, usage };
        await db.updateMessage(user.id, assistantMessageId, {
          content: assembled,
          metadata: meta,
          model: requestedModel,
        });
        if (usage) {
          await db.recordUsage({
            userId: user.id,
            conversationId,
            model: requestedModel,
            promptTokens: usage.prompt_tokens ?? 0,
            completionTokens: usage.completion_tokens ?? 0,
          });
        }
      };

      abort.addEventListener("abort", () => {
        stopped = true;
      });

      try {
        const res = await fetch(`${gateway.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gateway.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: abort,
        });

        if (!res.ok || !res.body) {
          const message = await readGatewayError(res);
          assembled = assembled || "";
          await finish("error", message);
          send({ type: "error", message });
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as {
                error?: { message?: string; code?: string; type?: string };
                choices?: Array<{
                  delta?: { content?: string; reasoning_content?: string };
                  finish_reason?: string | null;
                }>;
                usage?: { prompt_tokens?: number; completion_tokens?: number };
              };
              if (json.error) {
                const message = humanizeGatewayError(400, json);
                await finish("error", message);
                send({ type: "error", message });
                stopped = true;
                break;
              }
              const delta = json.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                assembled += delta;
                send({ type: "delta", text: delta });
              }
              if (json.usage) usage = json.usage;
            } catch {
              /* ignore malformed chunks */
            }
          }
        }

        if (stopped && abort.aborted) {
          await finish("stopped");
          send({ type: "done", conversationId, assistantMessageId });
        } else {
          await finish(assembled ? "complete" : "error");
          send({ type: "done", conversationId, assistantMessageId });
        }
        controller.close();
      } catch (err) {
        if (stopped || (err instanceof DOMException && err.name === "AbortError") || abort.aborted) {
          await finish("stopped");
          try {
            send({ type: "done", conversationId, assistantMessageId });
          } catch {
            /* closed */
          }
          controller.close();
          return;
        }
        const message =
          err instanceof Error ? err.message : "The AI service failed. Please try again.";
        await finish("error", message);
        try {
          send({ type: "error", message });
        } catch {
          /* closed */
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
