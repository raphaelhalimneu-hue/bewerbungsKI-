---
name: Pricing model
description: BewerbungsKI pricing since 2026-08-13 — credits model, limits, and where they are enforced
---

- Modell: 3 Bewerbungen kostenlos, danach 9,99 € einmalig (Stripe one-time, inline price_data, keine Price-ID) pro Paket mit 10 WEITEREN Bewerbungen (bis 2026-08-16: erst 30, dann kurz 20; Bestandskäufer behalten ihre alten credits). Pakete sind stapelbar (Nachkauf am Limit möglich).
- Guthaben-Modell (seit 2026-08-13): `credits`-Spalte in profiles; Limit = 3 + credits. Webhook checkout.session.completed: +10 credits, idempotent über stripe_events-Tabelle (Event-ID als PK, Insert-first in Transaktion). is_premium bleibt als Anzeige-Flag.
- Enforcement serverseitig in generate.ts: docCount ≥ Limit → `premium_limit_reached` wenn credits>0, sonst `free_limit_reached`.
- Schema-Änderungen shippen als idempotente Startup-Migration im API-Server (lib/migrate.ts läuft vor listen), weil drizzle push nur die Dev-DB trifft; Backfill: legacy is_premium mit credits=0 → 30.
- **Why:** Nutzer wollte hartes Limit statt "unbegrenzt/Lifetime"; Review verlangte Idempotenz (Stripe redelivert Events) und Erhalt der Alt-Käufer-Ansprüche beim Modellwechsel.
- **How to apply:** Bei Preis-/Limit-Änderungen alle Stellen synchron halten: checkout.ts (unit_amount + Beschreibung), generate.ts (Limit-Formel), me.ts (credits/document_limit), openapi.yaml + orval codegen, 8 i18n-Dateien (premiumPrice/oneTime/buyMore/limitReachedHint), index.html (Meta + JSON-LD), Mobile-App (noch alt, siehe Task).

- 2026-08-16: Stripe-Webhook in Produktion end-to-end verifiziert (rotierter Endpoint-Secret, signiertes Testevent → +10 credits + stripe_events-Row). Secret-Rotation: neuen Endpoint anlegen (Secret nur in Create-Response), Railway-Var setzen, redeployen, alten Endpoint löschen.
- Prod-DB direkt erreichbar via temporärem Railway tcpProxyCreate auf den Postgres-Service (danach tcpProxyDelete); DATABASE_URL ist internal-only.

- Betreiber-Konto (halimraphael9@gmail.com) hat unbegrenzt: Dokument-Limit und Tages-Quoten (analyze/perfect) werden per E-Mail-Check umgangen (env UNLIMITED_EMAILS, Default = Betreiber-Mail; in generate.ts, me.ts, analyze.ts). Seit 2026-08-16.


## Perfektionieren-Vorschau (2026-08-18)
Gratis-Nutzer dürfen /perfect nutzen und das Ergebnis ANSEHEN (Scanner + Preview), aber nicht speichern/exportieren: PATCH /documents, POST /documents, POST cv.docx sind für gesperrte Gratis-Nutzer 403; ?text=-Override bei cover-letter PDF/DOCX wird für sie ignoriert (nur gespeichertes Original). Der 1 freie Download (Original) bleibt frei. /analyze bleibt gesperrt.


## Power-Paket (2026-08-18)
Zweites Paket: 29,90 € einmalig = unbegrenzt Bewerbungen + 50× Perfektionieren (lifetime, atomar reserviert via perfect_count/is_unlimited in profiles) + stilles Fair-Use-Limit 10 Generierungen/Tag (DB-Zählung docs heute + In-Memory). Webhook upsertet Profile (kein verlorener Kauf), Doppelkauf von Power wird im /checkout mit 400 already_unlimited geblockt. Premium bleibt 9,99 € = +10 Credits.
