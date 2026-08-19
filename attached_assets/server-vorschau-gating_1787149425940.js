/**
 * server-vorschau-gating.js
 * -------------------------------------------------------------
 * Fertiger Baustein für Replit: kostenlose Nutzer bekommen nur eine
 * gekürzte Vorschau des perfektionierten Textes. Der volle Text wird
 * erst nach verifizierter Zahlung ausgeliefert.
 *
 * Einbau: In deine bestehende Route, wo aktuell der volle Text vom
 * KI-Call direkt zurückgegeben wird, diese Logik einbauen (Stellen
 * unten mit "HIER ANPASSEN" markiert).
 * -------------------------------------------------------------
 */

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

// Simple In-Memory-Speicher als Platzhalter.
// HIER ANPASSEN: durch deine echte DB ersetzen (z.B. Replit DB, Postgres, Supabase).
const generations = new Map();

// --- Hilfsfunktion: Vorschau erzeugen ---
// Zeigt einen sinnvollen Ausschnitt, aber nicht den kompletten Text.
// Bei Lebenslauf/Anschreiben z.B.: erste ~2 Sätze + letzter Satz abgeschnitten,
// damit klar wird "es ist fertig, aber du siehst nicht alles".
function erstelleVorschau(vollerText) {
  const woerter = vollerText.split(/\s+/);
  const anzahlSichtbar = Math.min(40, Math.ceil(woerter.length * 0.35)); // ~35%, max 40 Wörter
  const sichtbar = woerter.slice(0, anzahlSichtbar).join(" ");
  return sichtbar + " […]";
}

// --- Route: Text generieren (ersetzt/ergänzt deine bestehende Generate-Route) ---
router.post("/api/generate", async (req, res) => {
  try {
    // HIER ANPASSEN: dein bestehender KI-Aufruf
    const vollerText = await deinKiAufruf(req.body);

    const generationId = crypto.randomUUID();
    generations.set(generationId, {
      vollerText,
      bezahlt: false,
      userId: req.user?.id ?? req.session.id, // je nachdem was du für Nutzer-Identifikation hast
      erstelltAm: Date.now(),
    });

    const vorschau = erstelleVorschau(vollerText);

    res.json({
      generationId,
      vorschau,
      istVollstaendig: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Generierung fehlgeschlagen" });
  }
});

// --- Route: vollen Text abrufen (nur nach Zahlung) ---
router.get("/api/generation/:id/vollstaendig", (req, res) => {
  const eintrag = generations.get(req.params.id);

  if (!eintrag) {
    return res.status(404).json({ error: "Nicht gefunden" });
  }
  if (!eintrag.bezahlt) {
    return res.status(402).json({ error: "Zahlung erforderlich", generationId: req.params.id });
  }

  res.json({ vollerText: eintrag.vollerText, istVollstaendig: true });
});

// --- Route: von Zahlungsanbieter aufgerufen, NICHT vom Frontend ---
// Wichtig: bezahlt=true darf NUR hier gesetzt werden, serverseitig,
// nach echter Verifizierung (z.B. Stripe-Webhook-Signatur).
router.post("/api/webhook/zahlung-bestaetigt", express.raw({ type: "application/json" }), async (req, res) => {
  // HIER ANPASSEN: echte Signaturprüfung deines Zahlungsanbieters (z.B. Stripe)
  const { generationId } = verifiziereUndExtrahiereWebhook(req);

  const eintrag = generations.get(generationId);
  if (eintrag) {
    eintrag.bezahlt = true;
  }

  res.json({ received: true });
});

module.exports = router;
