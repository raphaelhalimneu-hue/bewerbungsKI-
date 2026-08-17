---
name: Briefkopf-Vorlagen
description: 19 nutzer-designte PNG-Briefkopf-Vorlagen (seit 2026-08-17), Architektur & Fallstricke
---

# Briefkopf-Vorlagen (seit 2026-08-17)

Der Nutzer hat eigene A4-Briefkopf-PNGs (1588×2246) geliefert; sie ersetzen die 14 alten Code-Vorlagen in der Auswahl. Quelle: attached_assets/briefkopf-finale-auswahl_*.zip + farbwerte-spezifikation.md.

**Regeln:**
- IDs: blobs, welle, halo, splitblock, klammern, winkel, bogen, zweig, berge, konfetti, wellenband, farbkreis, blobcorner, aurora, prisma, verlaufswelle, blaupause, technik, raster. Konfig (Datei, Akzent, Textzonen-Padding) in `LETTERHEADS` in buildCVHTML.ts; PNGs in bewerbungski/public/letterheads/.
- Alte 14 Template-IDs NICHT löschen: Bestandsdokumente und die Mobile-App (fest "modern") rendern damit weiter; sie sind nur nicht mehr wählbar.
- **Why:** Word/DOCX kann keine PNG-Hintergründe — dort wird nur die Akzentfarbe übernommen (TEMPLATE_THEMES in docx.ts). Anschreiben bekommen eine Akzentleiste (template-deco).
- **Fallstrick:** Der serverseitige CV-PDF-Puppeteer blockt alle Netz-Requests (SSRF); /letterheads/*.png wird im Interceptor von pdf.ts direkt von Disk (bewerbungski/dist/public) beantwortet — bei neuen Assets diese Ausnahme mitdenken.
- Default-Template für neue Nutzer: "blobs". Homepage-Showcase rendert ebenfalls "blobs".
