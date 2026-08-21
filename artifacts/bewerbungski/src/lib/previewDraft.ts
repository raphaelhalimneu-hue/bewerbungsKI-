export type PreviewDraft = {
  cvHtml?: string;
  coverLetter?: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function key(documentId: string) {
  return `bewerbungski:preview-draft:${documentId}`;
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readPreviewDraft(documentId: string, storage: StorageLike | null = browserStorage()): PreviewDraft {
  if (!documentId || !storage) return {};
  try {
    const value = JSON.parse(storage.getItem(key(documentId)) || "{}");
    if (!value || typeof value !== "object") return {};
    return {
      ...(typeof value.cvHtml === "string" ? { cvHtml: value.cvHtml } : {}),
      ...(typeof value.coverLetter === "string" ? { coverLetter: value.coverLetter } : {}),
    };
  } catch {
    return {};
  }
}

export function writePreviewDraft(documentId: string, changes: PreviewDraft, storage: StorageLike | null = browserStorage()) {
  if (!documentId || !storage) return;
  try {
    storage.setItem(key(documentId), JSON.stringify({ ...readPreviewDraft(documentId, storage), ...changes }));
  } catch {
    // Storage is a best-effort reload fallback; normal queued API saves remain authoritative.
  }
}

export function clearPreviewDraftField(
  documentId: string,
  field: keyof PreviewDraft,
  savedValue: string,
  storage: StorageLike | null = browserStorage(),
) {
  if (!documentId || !storage) return;
  const draft = readPreviewDraft(documentId, storage);
  if (draft[field] !== savedValue) return;
  delete draft[field];
  try {
    if (draft.cvHtml === undefined && draft.coverLetter === undefined) storage.removeItem(key(documentId));
    else storage.setItem(key(documentId), JSON.stringify(draft));
  } catch {
    // Keep the draft if storage cannot be updated; it is safe to re-send a later edit.
  }
}