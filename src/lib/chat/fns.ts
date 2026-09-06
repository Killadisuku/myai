import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { listGatewayModels } from "@/lib/ai/models";
import * as db from "./db";

export const getBootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const [conversations, assistants, settings, modelsResult] = await Promise.all([
      db.listConversations(context.userId),
      db.listAssistants(context.userId),
      db.getSettings(context.userId),
      listGatewayModels(),
    ]);
    return {
      conversations,
      assistants,
      settings,
      models: modelsResult.models,
      defaultModel: settings.defaultModel || modelsResult.defaultModel,
      gatewayLabel: modelsResult.gateway?.label ?? null,
      modelsError: modelsResult.error ?? null,
    };
  });

export const searchConversations = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((q: string) => q)
  .handler(async ({ context, data }) => db.listConversations(context.userId, data));

export const loadConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const conversation = await db.getConversation(context.userId, data);
    if (!conversation) return null;
    const [messages, attachments] = await Promise.all([
      db.listMessages(context.userId, data),
      db.listAttachments(context.userId, data),
    ]);
    return { conversation, messages, attachments };
  });

export const renameConversationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; title: string }) => input)
  .handler(async ({ context, data }) => {
    const title = data.title.trim();
    if (!title) return;
    await db.renameConversation(context.userId, data.id, title);
  });

export const deleteConversationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    await db.deleteConversation(context.userId, data);
  });

export const listAssistantsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => db.listAssistants(context.userId));

export const saveAssistantFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id?: string;
      name: string;
      description: string;
      avatar: string;
      systemPrompt: string;
      defaultModel: string | null;
      temperature: number | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    return db.upsertAssistant(context.userId, {
      ...data,
      name,
      description: data.description.trim(),
      systemPrompt: data.systemPrompt.trim(),
    });
  });

export const deleteAssistantFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    await db.deleteAssistant(context.userId, data);
  });

export const getSettingsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => db.getSettings(context.userId));

export const saveSettingsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      defaultModel?: string | null;
      temperature?: number;
      customInstructions?: string;
      theme?: "dark" | "light" | "system";
      sendOnEnter?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => db.saveSettings(context.userId, data));

export const getUsageFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => db.usageSummary(context.userId));

export const listModelsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const result = await listGatewayModels();
    return {
      models: result.models,
      defaultModel: result.defaultModel,
      gatewayLabel: result.gateway?.label ?? null,
      error: result.error ?? null,
    };
  });
