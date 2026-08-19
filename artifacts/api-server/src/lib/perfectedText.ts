export function createPerfectedPreview(fullText: string): string {
  const normalized = fullText.trim();
  if (!normalized) return "";
  if (normalized.length === 1) return "…";

  // Always return a strict prefix, even for a model output containing one
  // extremely long token. This guarantees preview !== full text.
  const targetLength = Math.max(24, Math.ceil(normalized.length * 0.35));
  const visibleLength = Math.max(1, Math.min(500, targetLength, normalized.length - 1));
  let preview = normalized.slice(0, visibleLength).trimEnd();
  const lastWhitespace = preview.search(/\s+\S*$/);
  if (lastWhitespace >= Math.floor(visibleLength * 0.6)) {
    preview = preview.slice(0, lastWhitespace).trimEnd();
  }
  return `${preview} […]`;
}