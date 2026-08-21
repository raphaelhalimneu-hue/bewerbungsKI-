import { Router } from "express";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

const router = Router();

router.get("/download/RaphaelKI2026", async (_req, res) => {
  try {
    const h1 = (text: string) =>
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
        children: [new TextRun({ text, bold: true, size: 28 })],
      });

    const line = (text: string) =>
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text, size: 22 })],
      });

    const bullet = (text: string) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text, size: 22 })],
      });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.TITLE,
              children: [
                new TextRun({
                  text: "BewerbungsKI - Alle wichtigen Daten",
                  bold: true,
                  size: 36,
                }),
              ],
            }),
            line("Stand: 8. August 2026"),
            line(""),

            h1("1. Deine Webseite"),
            bullet("Adresse: https://web-production-c5abc.up.railway.app"),
            bullet("Sprachversionen: /en  /tr  /ar  /uk  /ru  /pl  /es"),
            bullet("Beispiel Englisch: https://web-production-c5abc.up.railway.app/en"),
            line(""),

            h1("2. Dein Test-Login in der App"),
            bullet("E-Mail:   raphaelhalimneu+app@gmail.com"),
            bullet("Passwort: Bewerbung2026!"),
            bullet("ACHTUNG: raphaelhalimneu@gmail.com funktioniert NICHT (altes System)."),
            bullet("Neue Kunden registrieren sich mit E-Mail + Passwort - keine Bestaetigung."),
            line(""),

            h1("3. Kostenloser Zugang"),
            bullet("Alle Funktionen der App sind kostenlos verfügbar."),
            bullet("Der optionale Support-Link ist freiwillig und schaltet keine Funktionen frei."),
            line(""),

            h1("4. Technik - wo alles laeuft"),
            bullet("Hosting:      railway.com          (dein Konto)"),
            bullet("Kundendaten:  supabase.com         (Konto: raphaelhalimneu@gmail.com)"),
            bullet("KI:           console.anthropic.com (dein Konto - Guthaben im Blick behalten!)"),
            line(""),

            h1("5. WICHTIG - jede Woche tun!"),
            bullet("Mindestens 1x pro Woche auf supabase.com einloggen!"),
            bullet("Sonst pausiert das Konto automatisch und die Anmeldung funktioniert nicht."),
            line(""),

            h1("6. Tipps fuer dich"),
            bullet("Zum Testen: Adresse direkt in Chrome eintippen, nicht im Facebook-Fenster."),
            bullet("In Chrome: drei Punkte oben rechts - dann 'Zum Startbildschirm hinzufuegen'."),
            bullet("Bewerbungs-Erstellung kann bis zu 1 Minute dauern - das ist normal."),
            line(""),

            h1("7. Wenn etwas nicht geht"),
            bullet("Rote Fehlermeldung? Screenshot machen und im Chat schicken."),
            bullet("KI ausgelastet? 1-2 Minuten warten, nochmal versuchen."),
            bullet("Kunden koennen sich nicht anmelden? Auf supabase.com einloggen, Projekt pruefen."),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename=\"BewerbungsKI_Wichtige_Daten.docx\"");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error("docx generation error", err);
    res.status(500).json({ error: "Fehler beim Erstellen der Datei" });
  }
});

export default router;
