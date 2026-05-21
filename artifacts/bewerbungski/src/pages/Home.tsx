import { Layout } from "../components/Layout";
import { Link } from "wouter";
import { FiCheck, FiArrowRight } from "react-icons/fi";

export default function Home() {
  return (
    <Layout>
      <div className="hero fade">
        <div className="hero-badge">
          ✨ KI-Bewerbungen in 3 Minuten
        </div>
        <h1 className="hero-title">
          Dein Weg zum <em>Traumjob</em>
        </h1>
        <p className="hero-sub">
          Erstelle perfekt auf die deutsche Stellenanzeige abgestimmte Lebensläufe und Anschreiben. Kein Schreibblock mehr – nur noch Vorstellungsgespräche.
        </p>

        <div className="feats">
          <div className="feat"><FiCheck className="ok" /> DIN-gerecht</div>
          <div className="feat"><FiCheck className="ok" /> ATS-optimiert</div>
          <div className="feat"><FiCheck className="ok" /> 3 Designs</div>
        </div>

        <Link href="/wizard">
          <button className="btn btn-p btn-lg">
            Jetzt Bewerbung erstellen <FiArrowRight />
          </button>
        </Link>
      </div>

      <div className="grid3 mt-12 fade" style={{ animationDelay: "0.1s" }}>
        <div className="card text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--brand-l)] text-[var(--brand)] flex items-center justify-center text-xl mb-2">
            1
          </div>
          <h3 className="font-bold text-lg">Profil ausfüllen</h3>
          <p className="text-sm text-[var(--text2)]">Gib deine Erfahrungen und Fähigkeiten ein oder lade sie hoch.</p>
        </div>
        <div className="card text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--brand-l)] text-[var(--brand)] flex items-center justify-center text-xl mb-2">
            2
          </div>
          <h3 className="font-bold text-lg">Stelle angeben</h3>
          <p className="text-sm text-[var(--text2)]">Füge den Jobtitel und die Beschreibung der Wunschposition ein.</p>
        </div>
        <div className="card text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--brand-l)] text-[var(--brand)] flex items-center justify-center text-xl mb-2">
            3
          </div>
          <h3 className="font-bold text-lg">KI generiert</h3>
          <p className="text-sm text-[var(--text2)]">Erhalte maßgeschneiderte Dokumente in wenigen Sekunden.</p>
        </div>
      </div>
    </Layout>
  );
}
