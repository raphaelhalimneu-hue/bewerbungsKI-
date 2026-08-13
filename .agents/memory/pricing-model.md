---
name: Pricing model
description: BewerbungsKI pricing since 2026-08-13 — free/premium limits and where they are enforced
---

- Modell: 3 Bewerbungen kostenlos, danach 9,99 € einmalig (Stripe one-time, inline price_data, keine Price-ID) für 30 WEITERE Bewerbungen.
- Enforcement serverseitig: Nicht-Premium ≥3 Dokumente → free_limit_reached; Premium ≥33 Gesamt-Dokumente → premium_limit_reached (33 = 3 gratis + 30 gekauft, damit Käufer wirklich 30 bekommen).
- **Why:** Nutzer wollte hartes Limit statt "unbegrenzt/Lifetime"; Review fand die 27-statt-30-Falle beim Gesamtzähler.
- **How to apply:** Bei Preis-/Limit-Änderungen alle Stellen synchron halten: checkout.ts (unit_amount + Beschreibung), generate.ts (Limits), 8 i18n-Dateien (premiumPrice/oneTime/premFeat1/faq1A), index.html (Meta + JSON-LD), Mobile-App (noch alt, siehe Task), download.ts-Infodokument.
- Offene Sackgasse: Premium-Nutzer am 33er-Limit können kein weiteres Paket kaufen (Follow-up-Task vorhanden).
