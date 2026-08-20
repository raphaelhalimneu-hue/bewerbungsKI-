import { describe, expect, it } from "vitest";
import {
  applyImportedStyle,
  buildAnalyzeRequest,
  saveScanImport,
  saveWizardDesign,
  saveWizardPrefill,
  takeScanImport,
  takeWizardDesign,
  takeWizardPrefill,
  type SessionStorageLike,
} from "./importHandoff";

function memoryStorage(): SessionStorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => { data.delete(key); },
  };
}

const CV_TEXT = ("Max Mustermann\nBerufserfahrung\n" + "Erfahrung im Projektmanagement. ".repeat(4)).trimEnd();
const LETTER_TEXT = ("Sehr geehrte Damen und Herren,\n" + "ich bewerbe mich mit großem Interesse auf die ausgeschriebene Position. ".repeat(3)).trimEnd();
const CUSTOM_STYLE = {
  font: "sans" as const,
  accent: "#2563eb",
  headerBg: "#eff6ff",
  headerText: "#1e3a8a",
  subColor: "#475569",
  chipBg: "#dbeafe",
  chipText: "#1e40af",
};

describe("Import session handoff", () => {
  it("passes a CV from Import to Scanner and consumes both scan keys", () => {
    const storage = memoryStorage();
    saveScanImport(storage, `  ${CV_TEXT}  `, "cv");

    expect(takeScanImport(storage)).toEqual({ text: CV_TEXT, mode: "cv" });
    expect(storage.getItem("bk_scan_text")).toBeNull();
    expect(storage.getItem("bk_scan_mode")).toBeNull();
  });

  it("keeps an imported cover letter in letter mode for analysis, never CV mode", () => {
    const storage = memoryStorage();
    saveScanImport(storage, LETTER_TEXT, "letter");

    const imported = takeScanImport(storage);
    expect(imported).toEqual({ text: LETTER_TEXT, mode: "letter" });
    expect(buildAnalyzeRequest(imported!.text, imported!.mode, "de")).toMatchObject({
      cvText: LETTER_TEXT,
      docType: "letter",
    });
  });

  it("passes Import text to Wizard's free-text import and consumes it", () => {
    const storage = memoryStorage();
    saveWizardPrefill(storage, CV_TEXT);

    expect(takeWizardPrefill(storage)).toBe(CV_TEXT);
    expect(storage.getItem("bk_prefill_text")).toBeNull();
  });

  it("passes Scanner text to Wizard's free-text import and consumes it", () => {
    const storage = memoryStorage();
    saveWizardPrefill(storage, CV_TEXT);

    expect(takeWizardPrefill(storage)).toBe(CV_TEXT);
    expect(storage.getItem("bk_prefill_text")).toBeNull();
  });

  it("uses imported design JSON as the custom template", () => {
    const storage = memoryStorage();
    expect(saveWizardDesign(storage, CUSTOM_STYLE)).toBe(true);

    const style = takeWizardDesign(storage);
    const form = applyImportedStyle({
      personal: { firstName: "", lastName: "", title: "", email: "", phone: "", address: "", zip: "", city: "", linkedin: "", website: "", summary: "" },
      school: { type: "", name: "", city: "", year: "" },
      experience: [],
      education: [],
      skills: [],
      languages: [],
      jobad: { title: "", company: "", address: "", description: "" },
      template: "blobs",
    }, style!);

    expect(form.template).toBe("custom");
    expect(form.customStyle).toEqual(CUSTOM_STYLE);
    expect(storage.getItem("bk_prefill_style")).toBeNull();
  });
});