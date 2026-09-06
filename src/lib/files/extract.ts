import { chunkText, type TextChunk } from "./chunk";

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/javascript",
  "text/javascript",
  "text/html",
  "text/css",
  "application/xml",
  "text/xml",
]);

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

export const ALLOWED_TYPES = new Set([
  ...TEXT_TYPES,
  ...IMAGE_TYPES,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

export function isImageMime(mime: string) {
  return IMAGE_TYPES.has(mime) || mime.startsWith("image/");
}

export function isAllowedFile(name: string, mime: string) {
  if (ALLOWED_TYPES.has(mime)) return true;
  const ext = name.split(".").pop()?.toLowerCase();
  return Boolean(
    ext &&
      ["pdf", "txt", "md", "csv", "json", "docx", "doc", "png", "jpg", "jpeg", "webp", "gif"].includes(
        ext,
      ),
  );
}

function decodeBase64(dataBase64: string): Uint8Array {
  const cleaned = dataBase64.includes(",") ? dataBase64.split(",").pop()! : dataBase64;
  return Uint8Array.from(Buffer.from(cleaned, "base64"));
}

function bytesToText(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export type ExtractedDocument = {
  text: string;
  pageCount: number | null;
  chunks: TextChunk[];
  isImage: boolean;
};

export async function extractDocument(
  filename: string,
  mime: string,
  dataBase64: string,
): Promise<ExtractedDocument> {
  const lower = filename.toLowerCase();
  if (isImageMime(mime) || /\.(png|jpe?g|webp|gif)$/.test(lower)) {
    return { text: "", pageCount: null, chunks: [], isImage: true };
  }

  const bytes = decodeBase64(dataBase64);

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const result = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(result.text) ? result.text : [String(result.text ?? "")];
      const chunks: TextChunk[] = [];
      pages.forEach((pageText, i) => {
        chunks.push(...chunkText(String(pageText ?? ""), i + 1, chunks.length));
      });
      return {
        text: pages
          .map((t, i) => `--- Page ${i + 1} ---\n${t}`)
          .join("\n\n")
          .trim(),
        pageCount: pages.length,
        chunks,
        isImage: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF parse failed";
      return {
        text: `[Could not extract text from PDF: ${message}]`,
        pageCount: null,
        chunks: [],
        isImage: false,
      };
    }
  }

  if (
    mime.includes("wordprocessingml") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".doc")
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const text = result.value ?? "";
      return { text, pageCount: null, chunks: chunkText(text, null), isImage: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : "DOCX parse failed";
      return {
        text: `[Could not extract text from document: ${message}]`,
        pageCount: null,
        chunks: [],
        isImage: false,
      };
    }
  }

  const text = bytesToText(bytes);
  return { text, pageCount: null, chunks: chunkText(text, null), isImage: false };
}

export function decodeImageDataUrl(dataBase64: string, mime: string) {
  if (dataBase64.startsWith("data:")) return dataBase64;
  return `data:${mime};base64,${dataBase64}`;
}
