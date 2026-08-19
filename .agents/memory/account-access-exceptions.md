---
name: Kontofreigaben
description: Regel für Ausnahmezugänge bei Kauf- und Vorschau-Sperren
---

E-Mail-Ausnahmen für Kauf-, Vorschau- oder Verifikationssperren dürfen nie als Standardwert im Code hinterlegt werden. Sonderzugriff ist nur erlaubt, wenn die serverseitige Allowlist `UNLIMITED_EMAILS` ihn explizit konfiguriert.

**Why:** Ein fest eingebauter Standard umgeht in Produktion alle Sperren für dieses Konto und lässt Fehler beim Testen wie eine funktionierende Kaufprüfung aussehen.

**How to apply:** Bei neuen Berechtigungsprüfungen eine leere Allowlist als Standard verwenden. Testkonten müssen die normale Gratis- und Käuferlogik durchlaufen, sofern keine bewusste Server-Konfiguration gesetzt ist.