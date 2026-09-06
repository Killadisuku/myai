import type { Attachment, ChatMessage } from "./types";

export type ChatCache = {
  id: string;
  messages: ChatMessage[];
  attachments: Attachment[];
  title: string;
  model: string;
  assistantId: string | null;
};

let cache: ChatCache | null = null;

export function putChatCache(next: ChatCache) {
  cache = next;
}

export function takeChatCache(id: string) {
  if (cache && cache.id === id) {
    const hit = cache;
    cache = null;
    return hit;
  }
  return null;
}
