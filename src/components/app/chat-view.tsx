import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageBubble } from "./message-bubble";
import { Composer } from "./composer";
import { LogoMark } from "./logo";
import { PageHeader } from "./page-header";
import { ModelPicker } from "./model-picker";
import { useAppData } from "./app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { loadConversation } from "@/lib/chat/fns";
import { putChatCache, takeChatCache } from "@/lib/chat/session-cache";
import { authHeaders, nid, prettySlug, truncate } from "@/lib/utils";
import type {
  Attachment,
  ChatMessage,
  ChatStreamEvent,
  PendingFile,
} from "@/lib/chat/types";

const SUGGESTIONS = [
  "Explain a tricky TypeScript generic",
  "Draft a product spec from bullet points",
  "Review this function for race conditions",
  "Turn meeting notes into action items",
];

export function ChatView({ conversationId }: { conversationId?: string }) {
  const { models, defaultModel, modelsError, assistants, settings, refresh, openSidebar, conversations } = useAppData();
  const sendOnEnter = settings.sendOnEnter;
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [title, setTitle] = useState("New chat");
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [model, setModel] = useState(defaultModel);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const titleRef = useRef(title);
  titleRef.current = title;

  useEffect(() => {
    setModel((m) => m || defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    if (!conversationId || generating) return;
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv?.title) setTitle(conv.title);
  }, [conversations, conversationId, generating]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setError(null);
    setDraft("");
    setFiles([]);

    if (!conversationId) {
      setMessages([]);
      setAttachments([]);
      setTitle("New chat");
      setAssistantId(null);
      setLoading(false);
      return;
    }

    const cached = takeChatCache(conversationId);
    if (cached) {
      setMessages(cached.messages);
      setAttachments(cached.attachments);
      setTitle(cached.title);
      if (cached.model) setModel(cached.model);
      setAssistantId(cached.assistantId);
      setLoading(false);
    } else {
      setLoading(true);
      setMessages([]);
    }

    let cancelled = false;
    void loadConversation({ data: conversationId }).then((data) => {
      if (cancelled) return;
      if (!data) {
        setLoading(false);
        return;
      }
      setMessages(data.messages);
      setAttachments(data.attachments);
      setTitle(data.conversation.title || "Chat");
      if (data.conversation.model) setModel(data.conversation.model);
      setAssistantId(data.conversation.assistantId);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, generating]);

  async function runChat(
    payload: Record<string, unknown>,
    restore?: { content: string; files: PendingFile[]; userId: string },
  ) {
    setGenerating(true);
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;

    const assistantLocalId = nid();
    const streamingMsg: ChatMessage = {
      id: assistantLocalId,
      conversationId: conversationId || "pending",
      userId: "me",
      role: "assistant",
      content: "",
      model,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { status: "streaming" },
    };
    setMessages((prev) => [...prev, streamingMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
        signal: ac.signal,
        credentials: "same-origin",
      });
      if (!res.ok) {
        let message = "Something went wrong.";
        try {
          const json = (await res.json()) as { error?: string };
          message = json.error || message;
        } catch {
          /* ignore */
        }
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantLocalId && m.id !== restore?.userId),
        );
        if (restore) {
          setDraft(restore.content);
          setFiles(restore.files);
        }
        setError(message);
        setGenerating(false);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";
      let realAssistantId: string = assistantLocalId;
      let assembled = "";
      let navTo: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const raw = trimmed.slice(5).trim();
          if (!raw) continue;
          let event: ChatStreamEvent;
          try {
            event = JSON.parse(raw) as ChatStreamEvent;
          } catch {
            continue;
          }
          if (event.type === "meta") {
            realAssistantId = event.assistantMessageId;
            navTo = event.conversationId;
            setTitle(event.title || "Chat");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantLocalId
                  ? { ...m, id: event.assistantMessageId, conversationId: event.conversationId, model: event.model }
                  : m.conversationId === "pending"
                    ? { ...m, conversationId: event.conversationId }
                    : m,
              ),
            );
          } else if (event.type === "delta") {
            assembled += event.text;
            const id = realAssistantId;
            setMessages((prev) =>
              prev.map((m) => (m.id === id || m.id === assistantLocalId ? { ...m, content: assembled } : m)),
            );
          } else if (event.type === "error") {
            setError(event.message);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === realAssistantId || m.id === assistantLocalId
                  ? { ...m, metadata: { status: "error", error: event.message } }
                  : m,
              ),
            );
          } else if (event.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === event.assistantMessageId || m.id === assistantLocalId
                  ? { ...m, metadata: { status: assembled ? "complete" : m.metadata.status === "error" ? "error" : "complete" } }
                  : m,
              ),
            );
          }
        }
      }

      if (navTo && !conversationId) {
        putChatCache({
          id: navTo,
          messages: messagesRef.current,
          attachments,
          title: titleRef.current,
          model,
          assistantId,
        });
        refresh();
        void navigate({ to: "/c/$id", params: { id: navTo } });
      } else if (conversationId) {
        const loaded = await loadConversation({ data: conversationId });
        if (loaded) {
          setMessages(loaded.messages);
          setAttachments(loaded.attachments);
          setTitle(loaded.conversation.title || "Chat");
        }
        refresh();
      } else {
        refresh();
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.metadata.status === "streaming" ? { ...m, metadata: { status: "stopped" } } : m,
          ),
        );
      } else {
        setError(err instanceof Error ? err.message : "The request failed.");
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  function sendWith(content: string, pending: PendingFile[]) {
    if (!content.trim() && pending.length === 0) return;
    const userMsg: ChatMessage = {
      id: nid(),
      conversationId: conversationId || "pending",
      userId: "me",
      role: "user",
      content: content.trim() || "(attachment)",
      model,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!conversationId && content.trim()) {
      setTitle(truncate(content, 56));
    }
    setDraft("");
    setFiles([]);
    void runChat(
      {
        conversationId,
        content: content.trim(),
        model,
        assistantId,
        mode: "send",
        attachments: pending.map((f) => ({
          name: f.name,
          mime: f.mime,
          dataBase64: f.dataBase64,
          size: f.size,
        })),
      },
      { content: content.trim(), files: pending, userId: userMsg.id },
    );
  }

  function send() {
    sendWith(draft, files);
  }

  function retryLast() {
    const lastAssistant = [...messages].reverse().find((x) => x.role === "assistant");
    if (!lastAssistant || !conversationId) return;
    setMessages((prev) => prev.filter((x) => x.id !== lastAssistant.id));
    void runChat({
      conversationId,
      model,
      assistantId,
      mode: "regenerate",
      targetMessageId: lastAssistant.id,
    });
  }

  const empty = messages.length === 0 && !conversationId && !loading;
  const modelName = models.find((m) => m.slug === model)?.name || prettySlug(model) || "Select a model";

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <PageHeader
        title={empty ? "New chat" : title}
        subtitle={modelName}
        onOpenSidebar={openSidebar}
      >
        <div className="hidden md:block">
          <ModelPicker models={models} value={model} onChange={setModel} align="end" />
        </div>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        {loading && messages.length === 0 ? (
          <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-16 w-2/3 rounded-2xl" />
          </div>
        ) : empty ? (
          <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
            <LogoMark className="mb-5 size-12" />
            <h1 className="text-3xl font-semibold tracking-tight">What can I help with?</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Coding, research, writing, analysis. Your conversations stay in your account.
            </p>
            {modelsError && <p className="mt-3 text-sm text-destructive">{modelsError}</p>}
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-secondary"
                  onClick={() => sendWith(s, [])}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col py-4">
            {messages.map((m, i) => {
              const lastAssistant = [...messages].reverse().find((x) => x.role === "assistant");
              const canRegen = m.role === "assistant" && lastAssistant?.id === m.id && !generating;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  attachments={attachments}
                  streaming={generating && i === messages.length - 1 && m.role === "assistant"}
                  modelLabel={models.find((x) => x.slug === m.model)?.name}
                  onRegenerate={
                    canRegen
                      ? () => {
                          setMessages((prev) => prev.filter((x) => x.id !== m.id));
                          void runChat({
                            conversationId,
                            model,
                            assistantId,
                            mode: "regenerate",
                            targetMessageId: m.id,
                          });
                        }
                      : undefined
                  }
                  onEdit={
                    m.role === "user"
                      ? (content) => {
                          const idx = messages.findIndex((x) => x.id === m.id);
                          setMessages((prev) =>
                            prev.slice(0, idx + 1).map((x) => (x.id === m.id ? { ...x, content } : x)),
                          );
                          void runChat({
                            conversationId,
                            model,
                            assistantId,
                            mode: "edit",
                            targetMessageId: m.id,
                            editContent: content,
                          });
                        }
                      : undefined
                  }
                />
              );
            })}
            {error && (
              <div className="mx-auto flex max-w-3xl items-start justify-between gap-3 px-6 pb-4">
                <p className="text-sm text-destructive">{error}</p>
                {conversationId && !generating && (
                  <button type="button" className="shrink-0 text-sm text-muted-foreground hover:text-foreground" onClick={retryLast}>
                    Retry
                  </button>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <Composer
        value={draft}
        onChange={setDraft}
        onSend={send}
        onStop={() => abortRef.current?.abort()}
        generating={generating}
        files={files}
        onFiles={setFiles}
        models={models}
        model={model}
        onModel={setModel}
        assistants={assistants}
        assistantId={assistantId}
        onAssistant={setAssistantId}
        sendOnEnter={sendOnEnter}
      />
    </div>
  );
}
