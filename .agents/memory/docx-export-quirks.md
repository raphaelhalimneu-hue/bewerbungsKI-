---
name: DOCX/PDF-Export-Fallstricke
description: Rendering-Bugs bei Word-Downloads (Google Docs/Office Android) und beim clientseitigen CV-PDF
---

# DOCX/PDF-Export-Fallstricke

- **Prozent-Tabellenbreiten in DOCX vermeiden:** Google Docs (Android) rendert `WidthType.PERCENTAGE`-Spalten teils extrem schmal (Text erscheint vertikal, ein Buchstabe pro Zeile). Immer feste DXA-Breiten + `TableLayoutType.FIXED` nutzen; nutzbare Breite = 11906 − linke − rechte Marge (bei 900/900 → 10106 DXA).
- **Unicode-Spaces normalisieren:** KI-generierter Text enthält NBSP/schmale Leerzeichen (U+00A0, U+202F …); Office-Android rendert sie zero-width → Wörter kleben zusammen. Alle dynamischen TextRun-Texte durch `cleanText()` in docx.ts führen — auch bei künftigen neuen Runs.
- **CV-PDF unscharf auf Mobile:** Die Vorschau wird per CSS `zoom` verkleinert; html2canvas rastert sonst das geschrumpfte Element. Vor Capture `zoom=1` setzen, in `finally` zurücksetzen (Preview.tsx).
- **Why:** Nutzer ist mobile-only; Downloads werden in Google-Docs-/Office-Android-Viewern geöffnet, die deutlich strenger/fehlerhafter rendern als Desktop-Word.
- **Achtung Merges:** Ein Task-Merge hat docx.ts schon einmal korrumpiert (doppelte Deklarationen, vertauschte Variablen). Nach Merges, die docx.ts berühren, `node build.mjs` laufen lassen.
