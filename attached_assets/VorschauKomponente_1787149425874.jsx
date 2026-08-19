/**
 * VorschauKomponente.jsx
 * -------------------------------------------------------------
 * Zeigt kostenlosen Nutzern nur die Vorschau des perfektionierten
 * Textes, mit Blur-Effekt am Ende und einem Button zum Freischalten.
 * Nach Zahlung wird der volle Text nachgeladen.
 * -------------------------------------------------------------
 */

import { useState } from "react";

export default function VorschauKomponente({ generationId, vorschauText }) {
  const [vollerText, setVollerText] = useState(null);
  const [ladeVollstaendig, setLadeVollstaendig] = useState(false);

  async function textFreischalten() {
    // HIER ANPASSEN: Weiterleitung zu deinem Checkout
    // z.B. window.location.href = `/checkout?generationId=${generationId}`
    window.location.href = `/checkout?generationId=${generationId}`;
  }

  // Wird nach erfolgreicher Zahlung aufgerufen (z.B. auf der Erfolgsseite)
  async function vollenTextLaden() {
    setLadeVollstaendig(true);
    const res = await fetch(`/api/generation/${generationId}/vollstaendig`);
    if (res.ok) {
      const daten = await res.json();
      setVollerText(daten.vollerText);
    }
    setLadeVollstaendig(false);
  }

  if (vollerText) {
    return <div className="text-ergebnis">{vollerText}</div>;
  }

  return (
    <div className="vorschau-container" style={{ position: "relative" }}>
      <p className="vorschau-text">{vorschauText}</p>

      {/* Blur-Überlagerung suggeriert "hier geht noch mehr weiter" */}
      <div
        style={{
          position: "relative",
          height: "80px",
          marginTop: "-80px",
          background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1))",
        }}
      />

      <button onClick={textFreischalten} className="freischalten-button">
        Vollständigen Text freischalten – 9,99 €
      </button>

      <p className="hinweis-text" style={{ fontSize: "0.85rem", color: "#666" }}>
        Dein Lebenslauf/Anschreiben ist fertig optimiert. Schalte ihn frei, um den
        vollständigen Text zu sehen, zu kopieren und als PDF herunterzuladen.
      </p>
    </div>
  );
}
