import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "./model-picker";
import { AssistantPicker } from "./assistant-picker";
import { cn } from "@/lib/utils";
import type { CustomAssistant, ModelInfo, PendingFile } from "@/lib/chat/types";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 6;

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  generating,
  disabled,
  files,
  onFiles,
  models,
  model,
  onModel,
  assistants,
  assistantId,
  onAssistant,
  sendOnEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  generating: boolean;
  disabled?: boolean;
  files: PendingFile[];
  onFiles: (files: PendingFile[]) => void;
  models: ModelInfo[];
  model: string;
  onModel: (slug: string) => void;
  assistants: CustomAssistant[];
  assistantId: string | null;
  onAssistant: (id: string | null) => void;
  sendOnEnter: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const selected = models.find((m) => m.slug === model);
  const hasImages = files.some((f) => f.isImage);
  const visionWarning = hasImages && selected && !selected.supportsVision;

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      taRef.current?.focus();
    }
  }, []);

  function resize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (!sendOnEnter) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (!generating) onSend();
  }

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const next: PendingFile[] = [...files];
    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        toast.error("You can attach up to 6 files.");
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is larger than 4 MB.`);
        continue;
      }
      const dataBase64 = await readFile(file);
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        dataBase64,
        previewUrl: file.type.startsWith("image/") ? dataBase64 : undefined,
        isImage: file.type.startsWith("image/"),
      });
    }
    onFiles(next);
  }

  function onDrag(e: DragEvent, inside: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(inside);
  }

  const canSend = !disabled && (value.trim().length > 0 || files.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
      {visionWarning && (
        <p className="mb-2 rounded-2xl border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          This model does not support image input. Please select a vision-capable model.
        </p>
      )}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-2 py-1 text-xs"
            >
              {f.previewUrl && (
                <img src={f.previewUrl} alt="" className="size-8 rounded-lg object-cover" />
              )}
              <span className="max-w-32 truncate">{f.name}</span>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-secondary"
                onClick={() => onFiles(files.filter((x) => x.id !== f.id))}
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div
        onDragEnter={(e) => onDrag(e, true)}
        onDragOver={(e) => onDrag(e, true)}
        onDragLeave={(e) => onDrag(e, false)}
        onDrop={(e) => {
          onDrag(e, false);
          void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-[28px] border bg-card p-2 shadow-[var(--shadow)]",
          dragging ? "border-primary" : "border-border focus-within:border-border-strong",
        )}
      >
        {dragging && (
          <p className="px-3 py-2 text-sm text-muted-foreground">Drop files to attach</p>
        )}
        <textarea
          ref={taRef}
          value={value}
          rows={1}
          placeholder="Message MyAI"
          enterKeyHint="send"
          onChange={(e) => {
            onChange(e.target.value);
            resize();
          }}
          onInput={resize}
          onKeyDown={onKey}
          onPaste={(e) => {
            const pasted = e.clipboardData?.files;
            if (pasted && pasted.length > 0) {
              e.preventDefault();
              void addFiles(pasted);
            }
          }}
          disabled={disabled}
          className="max-h-56 min-h-12 w-full resize-none bg-transparent px-3 py-2.5 text-base leading-6 outline-none placeholder:text-muted-foreground md:text-[15px]"
        />
        <div className="flex items-center gap-1 px-1 pb-0.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.txt,.md,.csv,.json,.docx,.doc,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/plain,text/csv,application/json,image/*"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Attach files"
            onClick={() => fileRef.current?.click()}
            disabled={generating}
          >
            <Paperclip className="size-4" />
          </Button>
          <ModelPicker models={models} value={model} onChange={onModel} />
          <AssistantPicker assistants={assistants} value={assistantId} onChange={onAssistant} />
          <div className="ml-auto">
            {generating ? (
              <Button type="button" size="icon" onClick={onStop} aria-label="Stop generating">
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button type="button" size="icon" onClick={onSend} disabled={!canSend} aria-label="Send">
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
