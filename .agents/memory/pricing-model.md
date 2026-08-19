---
name: Pricing model
description: Free vs. paid boundaries for BewerbungsKI (policy 2026-08-19, mehrfach vom Nutzer bestätigt)
---

# Preismodell (Stand 2026-08-19)

**Regel (mehrfach explizit bestätigt): ALLES offen für Gratis-Nutzer — erstellen (unbegrenzt), importieren, prüfen, perfektionieren, bearbeiten, ansehen. NUR Downloads (PDF/Word) und Drucken sind kaufpflichtig.**

- Käufer: 9,99 € einmalig → 10 Bewerbungen (Paket-Limit `1+credits` nur für Käufer).
- Gratis: `document_limit` in /me = 999999; stille Fair-Use-Tagesquote (checkDailyGenQuota) in generate.ts schützt KI-Budget.
- Server-Sperren NUR: pdf.ts (beide Routen 403 upgrade_required für isFreeAccount), docx.ts (isFreeAccount), exports.ts (Druck: allowed:false, limit 0 für Gratis).
- isFreeQuotaLocked-Gates aus documents/extract/analyze/parse-linkedin ENTFERNT — nicht wieder einbauen ohne Nutzer-OK.
- Client Preview.tsx: editLocked=false; pdfLocked/cvPrintLocked/letterPrintLocked/docxLocked = freeUser → /pricing.
- Perfektionierte Vorschau: Gratis-Nutzer dürfen sie sehen, aber nicht per Browser kopieren; Käufer dürfen markieren und kopieren.
- Texte (8 Sprachen) angepasst: home.freeBadge/faq1A/ctaBottomSub, pricing.freeFeat1/4, premFeat4, locked.*, exitPopup.text.

**Why:** Nutzer will maximale Conversion: Leute sollen alles testen, zahlen nur fürs Herunterladen/Drucken.
**How to apply:** Neue Funktionen immer gratis; nur Export-Endpunkte (PDF/DOCX/Druck) gegen isFreeAccount sperren. Für perfektionierte Texte gilt zusätzlich die Kopiersperre in der Gratis-Vorschau.
