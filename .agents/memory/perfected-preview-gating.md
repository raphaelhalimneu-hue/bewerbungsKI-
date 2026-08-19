---
name: Perfektionierungs-Vorschau
description: Dauerhafte Produkt- und Sicherheitsregel für perfektionierte Bewerbungstexte
---

Gratis-Nutzer dürfen perfektionierte Ergebnisse nur als strikt gekürzte, serverseitig erzeugte Vorschau erhalten. Volltext und vollständiges Kurzprofil dürfen in keiner gesperrten API-Antwort erscheinen; auch modellgenerierte Änderungsnotizen bleiben dort weg.

**Why:** Ein Browser-Blur oder clientseitiges Kürzen würde den vollständigen Text weiterhin auslieferbar machen. Das Produkt verkauft die Freischaltung des fertigen Volltexts.

**How to apply:** Volltexte persistent und an eine konkrete Generierung gebunden speichern. Dokumente dürfen genau diese Generierung erst nach serverseitiger Kaufprüfung atomar übernehmen. Neue Antwortfelder für Gratis-Nutzer immer auf indirekte Volltext-Lecks prüfen.