---
name: Kontofreigaben
description: Regel für Ausnahmezugänge bei Kauf- und Vorschau-Sperren
---

Der Sonderzugriff für das Eigentümerprofil ist absichtlich auf genau ein explizit festgelegtes Konto begrenzt; beliebige E-Mail-Adressen oder eine frei befüllbare Produktions-Allowlist dürfen keine Kauf-, Vorschau- oder Verifikationssperren umgehen.

**Why:** Eine zu breite Allowlist hatte in Produktion alle Gratis-Konten wie Power-Konten behandelt und damit die Sperren unwirksam gemacht.

**How to apply:** Neue Berechtigungsprüfungen müssen dieselbe zentrale Owner-Prüfung verwenden. Alle anderen Konten müssen die normale Gratis- und Käuferlogik durchlaufen.