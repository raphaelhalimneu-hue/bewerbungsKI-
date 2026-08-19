---
name: Pricing model
description: Free vs. paid boundaries for BewerbungsKI after the one-application free trial
---

# Preismodell (Stand 2026-08-19)

**Regel (explizit bestätigt): Gratis-Nutzer können genau eine vollständige Bewerbung erstellen. Sobald dieses erste Dokument gespeichert ist, werden alle App-Funktionen bis zum Kauf gesperrt.**

- Käufer: Einzelbewerbung 2,99 € (+1), 5er-Paket 9,99 € (+5), 10er-Paket 14,99 € (+10); Power bleibt unbegrenzt für 29,90 €.
- Gratis: `document_limit` in `/me` = 1. Nach dem Speichern blockiert der Server Generierung, Import, Scanner/Analyse, Perfektionierung, Profil- und Dokumentzugriffe einschließlich Bearbeiten, Ansehen und Löschen.
- Die öffentlichen Seiten Start, Login/Registrierung und Preise bleiben zugänglich. Checkout bleibt erreichbar, damit die Sperre niemals einen Kauf verhindert.
- PDF-, Word- und Druckausgaben bleiben zusätzlich für Gratis-Konten gesperrt.
- Die Web-App entfernt nach Ablauf des Gratisversuchs die App-Navigation und leitet direkte Routen zur Preisseite weiter. Das ist nur UX; der Server ist die maßgebliche Sperre.

**Why:** Ein günstiger Einzelkauf senkt die Einstiegshürde; Pakete bieten gleichzeitig einen klaren Mengenrabatt.
**How to apply:** Jede neue authentifizierte App-Funktion darauf prüfen, ob sie nach dem ersten gespeicherten Gratis-Dokument serverseitig mit `isFreeQuotaLocked` abgewiesen werden muss. Öffentliche Marketing- und Kaufwege dürfen nicht gesperrt werden.
