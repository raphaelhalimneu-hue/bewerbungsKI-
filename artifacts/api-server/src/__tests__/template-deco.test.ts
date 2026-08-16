import { describe, it, expect } from "vitest";
import { DECO, TEMPLATE_IDS, templateDeco } from "@workspace/template-deco";

/**
 * Sichert die gemeinsame Deko-Quelle ab: Web-App (CV) und API-Server
 * (Anschreiben-PDF) importieren beide `@workspace/template-deco`.
 * Dieser Test stellt sicher, dass alle Vorlagen-IDs abgedeckt sind.
 */
describe("shared template deco", () => {
  it("kennt einen Deko-Eintrag für jede Vorlagen-ID", () => {
    expect(Object.keys(DECO).sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  it("liefert für jede Vorlage außer 'custom' eine nicht-leere Deko", () => {
    for (const id of TEMPLATE_IDS) {
      if (id === "custom") continue;
      expect(templateDeco(id), id).toContain("<div");
      expect(templateDeco(id)).toBe(DECO[id]);
    }
  });

  it("custom: erzeugt Akzentleiste nur mit gültiger Hexfarbe", () => {
    expect(templateDeco("custom", "#ff0000")).toContain("#ff0000");
    // ungültige/unsichere Werte fallen auf die Default-Farbe zurück
    expect(templateDeco("custom", "url(javascript:x)")).toContain("#1f2937");
    expect(templateDeco("custom", 42)).toContain("#1f2937");
  });

  it("unbekannte Vorlage → leerer String", () => {
    expect(templateDeco("does-not-exist")).toBe("");
    expect(templateDeco(null)).toBe("");
    expect(templateDeco(undefined)).toBe("");
  });
});
