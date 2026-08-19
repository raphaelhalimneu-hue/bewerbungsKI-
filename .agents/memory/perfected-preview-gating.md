---
name: Perfektionierungs-Vorschau
description: Dauerhafte Produkt- und Sicherheitsregel für perfektionierte Bewerbungstexte
---

Gratis-Nutzer dürfen perfektionierte Ergebnisse nur als strikt gekürzte, serverseitig erzeugte Vorschau erhalten. Volltext und vollständiges Kurzprofil dürfen in keiner gesperrten API-Antwort erscheinen; auch modellgenerierte Änderungsnotizen bleiben dort weg.

**Why:** Ein Browser-Blur oder clientseitiges Kürzen würde den vollständigen Text weiterhin auslieferbar machen. Das Produkt verkauft die Freischaltung des fertigen Volltexts.

**How to apply:** Volltexte persistent und an eine konkrete Generierung gebunden speichern. Dokumente dürfen genau diese Generierung erst nach serverseitiger Kaufprüfung atomar übernehmen. Neue Antwortfelder für Gratis-Nutzer immer auf indirekte Volltext-Lecks prüfen.

## Unterbrochene oder ältere Speichervorgänge

Ein Gratisdokument mit irgendeiner gespeicherten Perfektionierung muss gesperrt bleiben, selbst wenn die direkte Verknüpfung zur Generierung fehlt.

**Why:** Ältere Clients oder unterbrochene Writes können einen Volltext speichern, ohne den zugehörigen Sperrmarker zuverlässig zu hinterlassen. Eine reine Abfrage über die aktuelle Verknüpfung würde dann den Volltext als vermeintlichen Originaltext ausliefern.

**How to apply:** Bei der Dokumentauslieferung für Gratisnutzer auch vorhandene Perfektionierungsnachweise des Dokuments und ältere Marker berücksichtigen; immer die sichere Vorschau ausliefern, nie den gespeicherten Volltext.