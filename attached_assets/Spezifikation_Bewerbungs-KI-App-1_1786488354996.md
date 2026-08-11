# Spezifikation: Bewerbungs-KI-App

**Version:** 0.1 (Entwurf)
**Stand:** 12.08.2026

---

## 1. Zweck der App

Die App generiert auf Basis von Nutzereingaben professionelle Bewerbungsunterlagen (Anschreiben und Lebenslauf) für beliebige Berufe. Sie unterstützt **8 Sprachen** (Sprachliste vom Nutzer zu ergänzen — Platzhalter unten).

---

## 2. Sprachunterstützung

- Unterstützte Sprachen: `[ ]` `[ ]` `[ ]` `[ ]` `[ ]` `[ ]` `[ ]` `[ ]` *(bitte die 8 Zielsprachen eintragen)*
- Sprachauswahl erfolgt vor der Generierung; Oberfläche, generierter Text und PDF-Export müssen konsistent in der gewählten Sprache vorliegen.
- Länderspezifische Bewerbungsnormen (z. B. Foto ja/nein, Datumsformat, Anrede-Konventionen, Lebenslauf-Reihenfolge) sollten pro Sprache/Zielland hinterlegt werden, nicht nur die Übersetzung des deutschen Formats.
- Geschützte oder regulierte Berufsbezeichnungen (siehe 4.3) müssen pro Land/Sprache separat gepflegt werden, da Regulierung stark variiert.

---

## 3. Kernproblem aus dem Praxistest

Beim Testen mit minimalem Input erzeugte die App plausible, aber:
- inhaltlich generische Texte (Floskeln statt konkreter Substanz),
- bei mehreren Testprofilen zeitlich widersprüchliche Lebensläufe (parallele Vollzeit-Stationen),
- einen PDF-Export mit sichtbaren Markdown-Artefakten (` ```html `).

Die Spezifikation adressiert diese drei Punkte gezielt.

---

## 4. Funktionale Anforderungen

### 4.1 Pflichtfelder mit aktiver Rückfrage statt stiller Floskel-Generierung

Für jeden Bewerbungstyp definiert die App 2–3 "harte" Pflichtfelder, ohne die der Text zwangsläufig generisch bleibt:

| Feld | Zweck |
|---|---|
| Konkrete Berufserfahrung (Jahre/Stationen) | Ersetzt vage Aussagen wie "fundierte Kenntnisse" |
| Bezug zum Zielbetrieb (Stellenanzeige, Empfehlung, eigene Recherche) | Verhindert 1:1 austauschbare Anschreiben |
| Ein messbarer Erfolg oder eine Spezialisierung | Gibt dem Anschreiben ein Alleinstellungsmerkmal |

**Verhalten bei leerem Feld:**
- Aktive Rückfrage im Dialog ("Wie bist du auf den Betrieb aufmerksam geworden?"), **nicht** stille Generierung einer Floskel.
- Falls der Nutzer die Rückfrage überspringt: sichtbarer Hinweis im Output (z. B. "Dieser Abschnitt wirkt generisch — ergänze konkrete Erfahrung für ein stärkeres Anschreiben"), statt den Mangel zu kaschieren.

### 4.2 Prüfung geschützter/regulierter Berufsbezeichnungen

- Vor Ausgabe eines Titels wie z. B. "Diplom-Psychologe", "Facharzt", "Steuerberater" (länderspezifische Liste) prüft die App, ob die angegebene Qualifikation (Abschlussart, akkreditierte Institution) den Titel plausibel trägt.
- Bei Unsicherheit: Rückfrage an den Nutzer statt ungeprüfter Ausgabe.
- Diese Liste ist je nach Sprache/Zielland unterschiedlich zu pflegen (siehe 2.).

### 4.3 PDF-Export

- Der Export darf keine Roh-Marker aus der internen Formatierung (z. B. Markdown-Codeblock-Syntax) im finalen Dokument zeigen.
- Empfehlung: Rendering-Pipeline vor Export durch einen Zwischenschritt validieren (Diff zwischen internem Markdown und finalem PDF-Text), automatisierter Test auf bekannte Artefaktmuster.

### 4.4 Layout-Konsistenz

- Alle generierten Lebensläufe eines Nutzers (und idealerweise über Nutzer hinweg) folgen einem einheitlichen visuellen Template (Typografie, Linienführung, Abschnittsreihenfolge), unabhängig vom Zielberuf.

### 4.5 Textvarianz

- Die Anschreiben-Generierung soll erkennbar unterschiedliche Satzanfänge, Argumentationsreihenfolgen und Formulierungen je nach Beruf und Eingabe liefern — nicht dieselbe Schablone mit reinem Wortaustausch.

---

## 5. Nicht-funktionale Anforderungen

- **Sprachqualität:** Muttersprachliches Niveau in allen 8 Sprachen, keine Eins-zu-eins-Übersetzung aus dem Deutschen ohne kulturelle/formale Anpassung.
- **Nachvollziehbarkeit:** Rückfragen und Warnhinweise müssen für den Nutzer klar erkennbar und nicht versteckt sein.
- **Testbarkeit:** Für jede der drei Kernanforderungen (4.1–4.3) sollten automatisierte Testfälle mit absichtlich lückenhaftem/widersprüchlichem Input existieren.

---

## 6. Offene Punkte

- Liste der 8 Zielsprachen final festlegen.
- Liste regulierter Berufsbezeichnungen pro Zielland/-sprache erstellen.
- Entscheidung: Rückfrage als Dialog-Schritt vor Generierung oder als Hinweis nach Generierung (oder beides, je nach Feld).
