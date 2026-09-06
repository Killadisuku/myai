export type TextChunk = {
  content: string;
  pageNumber: number | null;
  index: number;
};

const TARGET = 900;
const OVERLAP = 120;

export function chunkText(text: string, pageNumber: number | null, startIndex = 0): TextChunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const paragraphs = cleaned.split(/\n{2,}/);
  const chunks: TextChunk[] = [];
  let buffer = "";
  let index = startIndex;

  const flush = () => {
    const content = buffer.trim();
    if (!content) return;
    chunks.push({ content, pageNumber, index });
    index += 1;
    if (OVERLAP > 0 && content.length > OVERLAP) {
      buffer = content.slice(-OVERLAP);
    } else {
      buffer = "";
    }
  };

  for (const p of paragraphs) {
    const piece = p.trim();
    if (!piece) continue;
    if ((buffer + "\n\n" + piece).length > TARGET && buffer) {
      flush();
    }
    buffer = buffer ? `${buffer}\n\n${piece}` : piece;
    if (buffer.length >= TARGET) flush();
  }
  if (buffer.trim()) {
    const content = buffer.trim();
    chunks.push({ content, pageNumber, index });
  }
  return chunks;
}

export function scoreChunk(query: string, chunk: string) {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2);
  if (!terms.length) return 0;
  const hay = chunk.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (hay.includes(t)) score += 1;
  }
  return score;
}

export function retrieveChunks(
  query: string,
  chunks: Array<{ content: string; pageNumber: number | null; filename?: string }>,
  limit = 6,
) {
  const ranked = chunks
    .map((c) => ({ ...c, score: scoreChunk(query, c.content) }))
    .sort((a, b) => b.score - a.score);
  const hits = ranked.filter((c) => c.score > 0).slice(0, limit);
  if (hits.length) return hits;
  // "Summarize this" and similar prompts have no keyword overlap — still send the opening pages.
  return chunks.slice(0, limit);
}
