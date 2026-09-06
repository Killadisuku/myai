import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Pencil,
  RefreshCw,
  User,
} from "lucide-react";
import { MarkdownBody } from "./markdown";
import { LogoMark } from "./logo";
import { Button } from "@/components/ui/button";
import { copyText, downloadText, authHeaders } from "@/lib/utils";
import type { Attachment, ChatMessage } from "@/lib/chat/types";

export function MessageBubble({
  message,
  attachments,
  streaming,
  modelLabel,
  onRegenerate,
  onEdit,
}: {
  message: ChatMessage;
  attachments: Attachment[];
  streaming?: boolean;
  modelLabel?: string;
  onRegenerate?: () => void;
  onEdit?: (content: string) => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const related = attachments.filter(
    (a) => a.messageId === message.id || message.metadata.attachmentIds?.includes(a.id),
  );
  const isError = message.metadata.status === "error";

  return (
    <article className="group w-full px-4 py-4 md:px-6">
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0">
          {isUser ? (
            <span className="grid size-8 place-items-center rounded-xl bg-secondary text-muted-foreground">
              <User className="size-4" />
            </span>
          ) : (
            <LogoMark className="size-8" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium">{isUser ? "You" : "MyAI"}</span>
            {!isUser && (modelLabel || message.model) && (
              <span className="text-[11px] text-muted-foreground">{modelLabel || message.model}</span>
            )}
          </div>
          {related.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {related.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground"
                >
                  {a.hasImage ? <ImageIcon className="size-3.5" /> : <FileText className="size-3.5" />}
                  {a.filename}
                </span>
              ))}
            </div>
          )}
          {related.some((a) => a.hasImage) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {related
                .filter((a) => a.hasImage)
                .map((a) => (
                  <AuthImage key={a.id} id={a.id} alt={a.filename} />
                ))}
            </div>
          )}
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-24 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const next = draft.trim();
                    if (!next) return;
                    setEditing(false);
                    onEdit?.(next);
                  }}
                >
                  Save & resend
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap text-[0.9875rem] leading-relaxed">{message.content}</p>
          ) : (
            <MarkdownBody content={message.content} streaming={streaming} />
          )}
          {isError && message.metadata.error && (
            <p className="mt-2 text-sm text-destructive">{message.metadata.error}</p>
          )}
          {message.metadata.status === "stopped" && (
            <p className="mt-2 text-xs text-muted-foreground">Generation stopped.</p>
          )}
          {!streaming && !editing && (
            <div className="mt-2 flex items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Copy"
                onClick={async () => {
                  if (await copyText(message.content)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  }
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
              {!isUser && message.content && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Download"
                  onClick={() => downloadText("myai-response.md", message.content, "text/markdown")}
                >
                  <Download className="size-3.5" />
                </Button>
              )}
              {isUser && onEdit && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit"
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
              )}
              {!isUser && onRegenerate && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={isError ? "Retry" : "Regenerate"}
                  onClick={onRegenerate}
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function AuthImage({ id, alt }: { id: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void fetch(`/api/attachments/${id}`, { headers: authHeaders(false), credentials: "same-origin" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (cancelled || !b) return;
        url = URL.createObjectURL(b);
        setSrc(url);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!src) return null;
  return <img src={src} alt={alt} className="max-h-56 rounded-2xl border border-border object-cover" />;
}
