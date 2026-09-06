import { getSql } from "@/lib/db";
import { nid, toIso } from "@/lib/utils";
import type {
  Attachment,
  ChatMessage,
  Conversation,
  CustomAssistant,
  MessageMetadata,
  UserSettings,
} from "./types";

type ConvRow = {
  id: string;
  user_id: string;
  title: string;
  assistant_id: string | null;
  model: string | null;
  created_at: unknown;
  updated_at: unknown;
  archived: boolean;
};

type MsgRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  created_at: unknown;
  updated_at: unknown;
  metadata: string;
};

type AttRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  message_id: string | null;
  filename: string;
  mime: string;
  size_bytes: number;
  extracted_text: string;
  page_count: number | null;
  image_data: string | null;
  created_at: unknown;
};

type AsstRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  avatar: string;
  system_prompt: string;
  default_model: string | null;
  temperature: number | null;
  created_at: unknown;
  updated_at: unknown;
};

type SetRow = {
  user_id: string;
  default_model: string | null;
  temperature: number;
  custom_instructions: string;
  theme: string;
  send_on_enter: boolean;
  updated_at: unknown;
};

function mapConv(r: ConvRow): Conversation {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    assistantId: r.assistant_id,
    model: r.model,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    archived: Boolean(r.archived),
  };
}

function parseMeta(raw: string): MessageMetadata {
  try {
    return JSON.parse(raw || "{}") as MessageMetadata;
  } catch {
    return {};
  }
}

function mapMsg(r: MsgRow): ChatMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    userId: r.user_id,
    role: r.role,
    content: r.content,
    model: r.model,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    metadata: parseMeta(r.metadata),
  };
}

function mapAtt(r: AttRow, includeText = false): Attachment {
  return {
    id: r.id,
    userId: r.user_id,
    conversationId: r.conversation_id,
    messageId: r.message_id,
    filename: r.filename,
    mime: r.mime,
    sizeBytes: Number(r.size_bytes) || 0,
    extractedText: includeText ? r.extracted_text : "",
    pageCount: r.page_count,
    hasImage: Boolean(r.image_data),
    createdAt: toIso(r.created_at),
  };
}

function mapAsst(r: AsstRow): CustomAssistant {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    avatar: r.avatar,
    systemPrompt: r.system_prompt,
    defaultModel: r.default_model,
    temperature: r.temperature,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

export async function listConversations(userId: string, query?: string) {
  const sql = await getSql();
  if (query && query.trim()) {
    const q = `%${query.trim()}%`;
    const rows = await sql<ConvRow>`
      select distinct c.id, c.user_id, c.title, c.assistant_id, c.model, c.created_at, c.updated_at, c.archived
      from conversations c
      left join messages m on m.conversation_id = c.id
      where c.user_id = ${userId}
        and c.archived = false
        and (c.title ilike ${q} or m.content ilike ${q})
      order by c.updated_at desc
      limit 200
    `;
    return rows.map(mapConv);
  }
  const rows = await sql<ConvRow>`
    select id, user_id, title, assistant_id, model, created_at, updated_at, archived
    from conversations
    where user_id = ${userId} and archived = false
    order by updated_at desc
    limit 200
  `;
  return rows.map(mapConv);
}

export async function getConversation(userId: string, id: string) {
  const sql = await getSql();
  const rows = await sql<ConvRow>`
    select id, user_id, title, assistant_id, model, created_at, updated_at, archived
    from conversations
    where id = ${id} and user_id = ${userId}
    limit 1
  `;
  return rows[0] ? mapConv(rows[0]) : null;
}

export async function createConversation(
  userId: string,
  input: { title?: string; model?: string | null; assistantId?: string | null },
) {
  const sql = await getSql();
  const id = nid();
  await sql`
    insert into conversations (id, user_id, title, model, assistant_id)
    values (${id}, ${userId}, ${input.title ?? "New chat"}, ${input.model ?? null}, ${input.assistantId ?? null})
  `;
  const created = await getConversation(userId, id);
  if (!created) throw new Error("Failed to create conversation");
  return created;
}

export async function renameConversation(userId: string, id: string, title: string) {
  const sql = await getSql();
  await sql`
    update conversations
    set title = ${title.slice(0, 120)}, updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
}

export async function deleteConversation(userId: string, id: string) {
  const sql = await getSql();
  await sql`delete from conversations where id = ${id} and user_id = ${userId}`;
}

export async function touchConversation(userId: string, id: string, fields?: { title?: string; model?: string | null }) {
  const sql = await getSql();
  if (fields?.title) {
    await sql`
      update conversations
      set title = ${fields.title}, model = coalesce(${fields.model ?? null}, model), updated_at = now()
      where id = ${id} and user_id = ${userId}
    `;
  } else {
    await sql`
      update conversations
      set model = coalesce(${fields?.model ?? null}, model), updated_at = now()
      where id = ${id} and user_id = ${userId}
    `;
  }
}

export async function listMessages(userId: string, conversationId: string) {
  const sql = await getSql();
  const owned = await getConversation(userId, conversationId);
  if (!owned) return [];
  const rows = await sql<MsgRow>`
    select id, conversation_id, user_id, role, content, model, created_at, updated_at, metadata
    from messages
    where conversation_id = ${conversationId} and user_id = ${userId}
    order by created_at asc
  `;
  return rows.map(mapMsg);
}

export async function insertMessage(input: {
  id?: string;
  userId: string;
  conversationId: string;
  role: ChatMessage["role"];
  content: string;
  model?: string | null;
  metadata?: MessageMetadata;
}) {
  const sql = await getSql();
  const id = input.id ?? nid();
  await sql`
    insert into messages (id, conversation_id, user_id, role, content, model, metadata)
    values (
      ${id}, ${input.conversationId}, ${input.userId}, ${input.role},
      ${input.content}, ${input.model ?? null}, ${JSON.stringify(input.metadata ?? {})}
    )
  `;
  return id;
}

export async function updateMessage(
  userId: string,
  id: string,
  patch: { content?: string; metadata?: MessageMetadata; model?: string | null },
) {
  const sql = await getSql();
  if (patch.content != null && patch.metadata) {
    await sql`
      update messages
      set content = ${patch.content},
          metadata = ${JSON.stringify(patch.metadata)},
          model = coalesce(${patch.model ?? null}, model),
          updated_at = now()
      where id = ${id} and user_id = ${userId}
    `;
  } else if (patch.content != null) {
    await sql`
      update messages set content = ${patch.content}, updated_at = now()
      where id = ${id} and user_id = ${userId}
    `;
  } else if (patch.metadata) {
    await sql`
      update messages set metadata = ${JSON.stringify(patch.metadata)}, updated_at = now()
      where id = ${id} and user_id = ${userId}
    `;
  }
}

export async function deleteMessagesAfter(userId: string, conversationId: string, createdAt: string, inclusiveId?: string) {
  const sql = await getSql();
  if (inclusiveId) {
    await sql`
      delete from messages
      where conversation_id = ${conversationId}
        and user_id = ${userId}
        and (created_at > ${createdAt} or id = ${inclusiveId})
    `;
  } else {
    await sql`
      delete from messages
      where conversation_id = ${conversationId}
        and user_id = ${userId}
        and created_at > ${createdAt}
    `;
  }
}

export async function getMessage(userId: string, id: string) {
  const sql = await getSql();
  const rows = await sql<MsgRow>`
    select id, conversation_id, user_id, role, content, model, created_at, updated_at, metadata
    from messages where id = ${id} and user_id = ${userId} limit 1
  `;
  return rows[0] ? mapMsg(rows[0]) : null;
}

export async function listAttachments(userId: string, conversationId: string) {
  const sql = await getSql();
  const rows = await sql<AttRow>`
    select id, user_id, conversation_id, message_id, filename, mime, size_bytes,
           extracted_text, page_count, image_data, created_at
    from attachments
    where conversation_id = ${conversationId} and user_id = ${userId}
    order by created_at asc
  `;
  return rows.map((r) => mapAtt(r, false));
}

export async function insertAttachment(input: {
  userId: string;
  conversationId: string;
  messageId?: string | null;
  filename: string;
  mime: string;
  sizeBytes: number;
  extractedText: string;
  pageCount: number | null;
  imageData: string | null;
}) {
  const sql = await getSql();
  const id = nid();
  await sql`
    insert into attachments (
      id, user_id, conversation_id, message_id, filename, mime, size_bytes,
      extracted_text, page_count, image_data
    ) values (
      ${id}, ${input.userId}, ${input.conversationId}, ${input.messageId ?? null},
      ${input.filename}, ${input.mime}, ${input.sizeBytes}, ${input.extractedText},
      ${input.pageCount}, ${input.imageData}
    )
  `;
  return id;
}

export async function getAttachmentImage(userId: string, id: string) {
  const sql = await getSql();
  const rows = await sql<{ image_data: string | null; mime: string; filename: string }>`
    select image_data, mime, filename from attachments
    where id = ${id} and user_id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

export async function insertChunks(
  userId: string,
  conversationId: string,
  attachmentId: string,
  chunks: Array<{ content: string; pageNumber: number | null; index: number }>,
) {
  const sql = await getSql();
  for (const c of chunks) {
    await sql`
      insert into document_chunks (id, user_id, attachment_id, conversation_id, chunk_index, page_number, content)
      values (${nid()}, ${userId}, ${attachmentId}, ${conversationId}, ${c.index}, ${c.pageNumber}, ${c.content})
    `;
  }
}

export async function listChunks(userId: string, conversationId: string) {
  const sql = await getSql();
  return sql<{
    content: string;
    page_number: number | null;
    filename: string;
  }>`
    select d.content, d.page_number, a.filename
    from document_chunks d
    join attachments a on a.id = d.attachment_id
    where d.conversation_id = ${conversationId} and d.user_id = ${userId}
  `;
}

export async function listAssistants(userId: string) {
  const sql = await getSql();
  const rows = await sql<AsstRow>`
    select id, user_id, name, description, avatar, system_prompt, default_model, temperature, created_at, updated_at
    from custom_assistants
    where user_id = ${userId}
    order by updated_at desc
  `;
  return rows.map(mapAsst);
}

export async function getAssistant(userId: string, id: string) {
  const sql = await getSql();
  const rows = await sql<AsstRow>`
    select id, user_id, name, description, avatar, system_prompt, default_model, temperature, created_at, updated_at
    from custom_assistants where id = ${id} and user_id = ${userId} limit 1
  `;
  return rows[0] ? mapAsst(rows[0]) : null;
}

export async function upsertAssistant(
  userId: string,
  input: {
    id?: string;
    name: string;
    description: string;
    avatar: string;
    systemPrompt: string;
    defaultModel: string | null;
    temperature: number | null;
  },
) {
  const sql = await getSql();
  const id = input.id ?? nid();
  if (input.id) {
    await sql`
      update custom_assistants set
        name = ${input.name},
        description = ${input.description},
        avatar = ${input.avatar},
        system_prompt = ${input.systemPrompt},
        default_model = ${input.defaultModel},
        temperature = ${input.temperature},
        updated_at = now()
      where id = ${id} and user_id = ${userId}
    `;
  } else {
    await sql`
      insert into custom_assistants (
        id, user_id, name, description, avatar, system_prompt, default_model, temperature
      ) values (
        ${id}, ${userId}, ${input.name}, ${input.description}, ${input.avatar},
        ${input.systemPrompt}, ${input.defaultModel}, ${input.temperature}
      )
    `;
  }
  const saved = await getAssistant(userId, id);
  if (!saved) throw new Error("Failed to save assistant");
  return saved;
}

export async function deleteAssistant(userId: string, id: string) {
  const sql = await getSql();
  await sql`delete from custom_assistants where id = ${id} and user_id = ${userId}`;
}

const DEFAULT_SETTINGS: Omit<UserSettings, "userId" | "updatedAt"> = {
  defaultModel: null,
  temperature: 0.7,
  customInstructions: "",
  theme: "dark",
  sendOnEnter: true,
};

export async function getSettings(userId: string): Promise<UserSettings> {
  const sql = await getSql();
  const rows = await sql<SetRow>`
    select user_id, default_model, temperature, custom_instructions, theme, send_on_enter, updated_at
    from user_settings where user_id = ${userId} limit 1
  `;
  const r = rows[0];
  if (!r) {
    return { userId, ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
  }
  const theme = r.theme === "light" || r.theme === "system" ? r.theme : "dark";
  return {
    userId: r.user_id,
    defaultModel: r.default_model,
    temperature: Number(r.temperature) || 0.7,
    customInstructions: r.custom_instructions,
    theme,
    sendOnEnter: Boolean(r.send_on_enter),
    updatedAt: toIso(r.updated_at),
  };
}

export async function saveSettings(
  userId: string,
  patch: Partial<Omit<UserSettings, "userId" | "updatedAt">>,
) {
  const current = await getSettings(userId);
  const next = { ...current, ...patch };
  const sql = await getSql();
  await sql`
    insert into user_settings (user_id, default_model, temperature, custom_instructions, theme, send_on_enter, updated_at)
    values (
      ${userId}, ${next.defaultModel}, ${next.temperature}, ${next.customInstructions},
      ${next.theme}, ${next.sendOnEnter}, now()
    )
    on conflict (user_id) do update set
      default_model = excluded.default_model,
      temperature = excluded.temperature,
      custom_instructions = excluded.custom_instructions,
      theme = excluded.theme,
      send_on_enter = excluded.send_on_enter,
      updated_at = now()
  `;
  return getSettings(userId);
}

export async function recordUsage(input: {
  userId: string;
  conversationId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const sql = await getSql();
  await sql`
    insert into api_usage (id, user_id, conversation_id, model, prompt_tokens, completion_tokens)
    values (${nid()}, ${input.userId}, ${input.conversationId}, ${input.model}, ${input.promptTokens}, ${input.completionTokens})
  `;
}

export async function usageSummary(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ n: number; prompt: number; completion: number }>`
    select count(*)::int as n,
           coalesce(sum(prompt_tokens), 0)::int as prompt,
           coalesce(sum(completion_tokens), 0)::int as completion
    from api_usage where user_id = ${userId}
  `;
  return {
    requests: rows[0]?.n ?? 0,
    promptTokens: rows[0]?.prompt ?? 0,
    completionTokens: rows[0]?.completion ?? 0,
  };
}
