import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

type Purchase = {
  id: string;
  amount: number;
  currency: string;
  created: number;
  email: string;
  status: string;
  refunded: boolean;
  amountRefunded: number;
};

export default function Admin() {
  const { user, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const data = await customFetch<{ purchases: Purchase[] }>("/api/admin/purchases");
      setPurchases(data.purchases);
    } catch (e: any) {
      if (e?.status === 403) setError("kein-zugriff");
      else setError("fehler");
    }
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function handleRefund(p: Purchase) {
    const eur = (p.amount / 100).toFixed(2).replace(".", ",");
    if (!confirm(`Wirklich ${eur} € an ${p.email || "den Käufer"} zurückerstatten? Das kann nicht rückgängig gemacht werden.`)) return;
    setRefunding(p.id);
    try {
      await customFetch("/api/admin/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId: p.id }),
      });
      toast({ title: "Rückerstattung ausgelöst ✅" });
      await load();
    } catch (e: any) {
      toast({ title: "Rückerstattung fehlgeschlagen", description: e?.message || "", variant: "destructive" });
    } finally {
      setRefunding(null);
    }
  }

  const total = (purchases || []).filter((p) => !p.refunded && p.status === "succeeded").reduce((s, p) => s + p.amount - p.amountRefunded, 0);

  return (
    <Layout>
      <div className="fade">
        <h2 style={{ fontFamily: "var(--fd)", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Verkäufe</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Nur für dich sichtbar.</p>

        {!user ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>🔒</div>
            <p style={{ marginBottom: 20 }}>Bitte melde dich an.</p>
            <button className="btn btn-p" onClick={() => setShowAuthModal(true)}>Anmelden</button>
          </div>
        ) : error === "kein-zugriff" ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>Diese Seite ist nur für den Betreiber.</div>
        ) : error ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ marginBottom: 16 }}>Konnte die Verkäufe nicht laden.</p>
            <button className="btn btn-p" onClick={load}>Nochmal versuchen</button>
          </div>
        ) : purchases === null ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>Lade Verkäufe…</div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Einnahmen (letzte 50 Käufe)</span>
              <strong style={{ fontSize: 20 }}>{(total / 100).toFixed(2).replace(".", ",")} €</strong>
            </div>

            {purchases.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>Noch keine Käufe. 🕐</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {purchases.map((p) => (
                  <div key={p.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.email || "Unbekannt"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(p.created * 1000).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700 }}>{(p.amount / 100).toFixed(2).replace(".", ",")} €</div>
                    {p.refunded ? (
                      <span style={{ fontSize: 12, background: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: 999 }}>Erstattet</span>
                    ) : p.status === "succeeded" ? (
                      <button
                        className="btn"
                        style={{ fontSize: 13 }}
                        disabled={refunding === p.id}
                        onClick={() => handleRefund(p)}
                      >
                        {refunding === p.id ? "…" : "Zurückerstatten"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{p.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
