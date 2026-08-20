import type { CustomStyle, FormData } from "./buildCVHTML";

export type ScanMode = "cv" | "letter";

export type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveScanImport(storage: SessionStorageLike, text: string, mode: ScanMode) {
  storage.setItem("bk_scan_text", text.trim());
  storage.setItem("bk_scan_mode", mode);
}

export function takeScanImport(storage: SessionStorageLike): { text: string; mode: ScanMode } | null {
  const text = storage.getItem("bk_scan_text");
  const storedMode = storage.getItem("bk_scan_mode");
  storage.removeItem("bk_scan_text");
  storage.removeItem("bk_scan_mode");

  if (!text) return null;
  return { text, mode: storedMode === "letter" ? "letter" : "cv" };
}

export function saveWizardPrefill(storage: SessionStorageLike, text: string) {
  storage.setItem("bk_prefill_text", text.trim());
}

export function takeWizardPrefill(storage: SessionStorageLike): string | null {
  const text = storage.getItem("bk_prefill_text");
  storage.removeItem("bk_prefill_text");
  return text && text.trim().length >= 30 ? text : null;
}

export function saveWizardDesign(storage: SessionStorageLike, style: unknown): boolean {
  if (!style || typeof (style as { accent?: unknown }).accent !== "string") return false;
  storage.setItem("bk_prefill_style", JSON.stringify(style));
  return true;
}

export function takeWizardDesign(storage: SessionStorageLike): CustomStyle | null {
  const serialized = storage.getItem("bk_prefill_style");
  storage.removeItem("bk_prefill_style");
  if (!serialized) return null;

  try {
    const style = JSON.parse(serialized);
    return style && typeof style.accent === "string" ? style as CustomStyle : null;
  } catch {
    return null;
  }
}

export function applyImportedStyle(form: FormData, customStyle: CustomStyle): FormData {
  return { ...form, customStyle, template: "custom" };
}

export function buildAnalyzeRequest(text: string, mode: ScanMode, language: string) {
  return { cvText: text.trim(), docType: mode, language };
}