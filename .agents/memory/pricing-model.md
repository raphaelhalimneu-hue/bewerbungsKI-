---
name: Pricing model
description: Free vs. paid boundaries for BewerbungsKI (policy of 2026-08-19)
---

# Preismodell (Stand 2026-08-19, Nutzer-Entscheidung, mehrfach bekräftigt)

**Regel: ALLES ist für Gratis-Nutzer offen — erstellen (unbegrenzt), importieren, prüfen, perfektionieren, bearbeiten, ansehen. NUR Downloads (PDF/Word) und Drucken sind kaufpflichtig.**

- Käufer: 9,99 € einmalig → 10 Bewerbungen (Paket-Limit `1+credits` gilt nur noch für Käufer).
- Gratis: `document_limit` in /me = 999999; Erstellen ohne Dokument-Limit, aber stille Fair-Use-Tagesquote (checkDailyGenQuota) in generate.ts schützt das KI-Budget.
- Server-Sperren nur noch: pdf.ts (beide Routen 403 upgrade_required für isFreeAccount), docx.ts (isFreeAccount), exports.ts (Druck: allowed:false für Gratis, limit 0).
- Alle isFreeQuotaLocked-Gates aus documents/extract/analyze/parse-linkedin ENTFERNT — nicht wieder einbauen ohne Nutzer-OK.
- Client Preview.tsx: editLocked=false; pdfLocked/cvPrintLocked/letterPrintLocked/docxLocked = freeUser → /pricing.
- Beschreibungen (8 Sprachen) angepasst: home.freeBadge/faq1A/ctaBottomSub, pricing.freeFeat1/4, premFeat4, locked.*, exitPopup.text.

**Why:** Nutzer will maximale Conversion: „Alle Funktionen auf lassen, außer Downloads und Drucken" — die Leute sollen ihr Ergebnis sehen, zahlen nur fürs Mitnehmen.
**How to apply:** Jede neue Funktion ist gratis nutzbar; nur Export-Endpunkte (PDF/DOCX/Druck) gegen isFreeAccount sperren.
