---
name: Pricing model
description: BewerbungsKI pricing since 2026-08-13 — credits model, limits, and where they are enforced
---

- Modell: 3 Bewerbungen kostenlos, danach 9,99 € einmalig (Stripe one-time, inline price_data, keine Price-ID) pro Paket mit 20 WEITEREN Bewerbungen (bis 2026-08-16: 30; Bestandskäufer behalten ihre 30 credits). Pakete sind stapelbar (Nachkauf am Limit möglich).
- Guthaben-Modell (seit 2026-08-13): `credits`-Spalte in profiles; Limit = 3 + credits. Webhook checkout.session.completed: +20 credits, idempotent über stripe_events-Tabelle (Event-ID als PK, Insert-first in Transaktion). is_premium bleibt als Anzeige-Flag.
- Enforcement serverseitig in generate.ts: docCount ≥ Limit → `premium_limit_reached` wenn credits>0, sonst `free_limit_reached`.
- Schema-Änderungen shippen als idempotente Startup-Migration im API-Server (lib/migrate.ts läuft vor listen), weil drizzle push nur die Dev-DB trifft; Backfill: legacy is_premium mit credits=0 → 30.
- **Why:** Nutzer wollte hartes Limit statt "unbegrenzt/Lifetime"; Review verlangte Idempotenz (Stripe redelivert Events) und Erhalt der Alt-Käufer-Ansprüche beim Modellwechsel.
- **How to apply:** Bei Preis-/Limit-Änderungen alle Stellen synchron halten: checkout.ts (unit_amount + Beschreibung), generate.ts (Limit-Formel), me.ts (credits/document_limit), openapi.yaml + orval codegen, 8 i18n-Dateien (premiumPrice/oneTime/buyMore/limitReachedHint), index.html (Meta + JSON-LD), Mobile-App (noch alt, siehe Task).
