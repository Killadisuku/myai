export type ChatRole = "user" | "assistant" | "system";

export type MessageMetadata = {
  status?: "streaming" | "complete" | "error" | "stopped";
  error?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  regeneratedFrom?: string;
  edited?: boolean;
  attachmentIds?: string[];
};

export type Conversation = {
  id: string;
  userId: string;
  title: string;
  assistantId: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  userId: string;
  role: ChatRole;
  content: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: MessageMetadata;
};

export type Attachment = {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string | null;
  filename: string;
  mime: string;
  sizeBytes: number;
  extractedText: string;
  pageCount: number | null;
  hasImage: boolean;
  createdAt: string;
};

export type DocumentChunk = {
  id: string;
  attachmentId: string;
  conversationId: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
};

export type CustomAssistant = {
  id: string;
  userId: string;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  defaultModel: string | null;
  temperature: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UserSettings = {
  userId: string;
  defaultModel: string | null;
  temperature: number;
  customInstructions: string;
  theme: "dark" | "light" | "system";
  sendOnEnter: boolean;
  updatedAt: string;
};

export type ModelInfo = {
  slug: string;
  name: string;
  provider: string;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportsVision: boolean;
  supportsTemperature: boolean;
  available: boolean;
  promotional: boolean;
  pricing: {
    inputPerMillion: number | null;
    outputPerMillion: number | null;
  };
  status: string;
};

export type PendingFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  dataBase64: string;
  previewUrl?: string;
  isImage: boolean;
};

export type ChatStreamEvent =
  | {
      type: "meta";
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
      title: string;
      model: string;
    }
  | { type: "delta"; text: string }
  | { type: "done"; conversationId: string; assistantMessageId: string }
  | { type: "error"; message: string };
