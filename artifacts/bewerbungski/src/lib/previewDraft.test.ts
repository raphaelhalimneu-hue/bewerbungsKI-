import { describe, expect, it } from "vitest";
import {
  clearPreviewDraftField,
  readPreviewDraft,
  writePreviewDraft,
  type StorageLike,
} from "./previewDraft";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe("preview drafts", () => {
  it("restores CV and letter edits immediately after an interrupted reload", () => {
    const storage = memoryStorage();
    writePreviewDraft("document-1", { cvHtml: "<p>Neue CV-Zeile</p>" }, storage);
    writePreviewDraft("document-1", { coverLetter: "Neues Anschreiben" }, storage);

    expect(readPreviewDraft("document-1", storage)).toEqual({
      cvHtml: "<p>Neue CV-Zeile</p>",
      coverLetter: "Neues Anschreiben",
    });
  });

  it("only clears the exact draft revision confirmed by the API", () => {
    const storage = memoryStorage();
    writePreviewDraft("document-1", { coverLetter: "Neuere Fassung" }, storage);

    clearPreviewDraftField("document-1", "coverLetter", "Ältere Fassung", storage);
    expect(readPreviewDraft("document-1", storage).coverLetter).toBe("Neuere Fassung");

    clearPreviewDraftField("document-1", "coverLetter", "Neuere Fassung", storage);
    expect(readPreviewDraft("document-1", storage)).toEqual({});
  });
});