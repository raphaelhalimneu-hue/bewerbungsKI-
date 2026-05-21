import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCreateCheckout } from "@workspace/api-client-react";

export default function Pricing() {
  const { user, profile, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const checkoutMutation = useCreateCheckout();

  async function handleUpgrade() {
    if (!user) { setShowAuthModal(true); return; }
    try {
      toast({ title: "Weiterleitung zu Stripe …" });
      const res = await checkoutMutation.mutateAsync({});
      if ((res as any).url) window.location.href = (res as any).url;
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  }

  return (
    <Layout>
      <div className="fade">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: "var(--fd)", fontSize: "clamp(28px,5vw,48px)", fontWeight: 700, letterSpacing: "-.02em", marginBottom: 12 }}>
            Einfache, faire Preise
          </h1>
          <p style={{ fontSize: 17, color: "var(--muted)" }}>Einmalig zahlen — für immer nutzen.</p>
        </div>

        <div className="grid2" style={{ maxWidth: 700, margin: "0 auto", gap: 20 }}>
          {/* Free */}
          <div className="pc">
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 16 }}>Free</div>
            <div className="price-num" style={{ color: "var(--text)" }}>0 €</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>Für immer kostenlos</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {["1 Bewerbung erstellen", "Alle 3 Vorlagen", "KI-Lebenslauf & Anschreiben", "Sicher gespeichert"].map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                  <span style={{ color: "var(--ok)", flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button className="btn btn-s btn-full" disabled>Aktueller Plan</button>
          </div>

          {/* Premium */}
          <div className="pc hot">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".08em" }}>Premium</div>
              <span className="tag tag-w">Beliebt</span>
            </div>
            <div className="price-num">9,90 €</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>Einmalig — Lifetime</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {[
                "Unbegrenzte Bewerbungen",
                "Alle 3 Vorlagen",
                "KI-Lebenslauf & Anschreiben",
                "Prioritäts-Support",
                "Alle zukünftigen Features",
              ].map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                  <span style={{ color: "var(--ok)", flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            {profile?.is_premium ? (
              <div style={{ background: "#dcfce7", color: "var(--ok)", borderRadius: 10, padding: "12px 20px", textAlign: "center", fontWeight: 600, fontSize: 14 }}>
                ✓ Premium aktiv
              </div>
            ) : (
              <button
                className="btn btn-p btn-full btn-lg"
                onClick={handleUpgrade}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? <span className="spin" /> : null}
                {checkoutMutation.isPending ? "Wird geladen …" : "Jetzt upgraden →"}
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 28, fontSize: 13, color: "var(--muted)" }}>
          Fragen? Schreib uns: support@bewerbungski.de
        </p>
      </div>
    </Layout>
  );
}
