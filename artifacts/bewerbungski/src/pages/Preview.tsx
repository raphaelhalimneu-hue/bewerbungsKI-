import { useParams, useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useGetDocument } from "@workspace/api-client-react";

export default function Preview() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: doc, isLoading, error } = useGetDocument(params.id, { query: { enabled: !!params.id } });

  function handlePrint() {
    window.print();
  }

  return (
    <Layout>
      <div className="fade">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="btn btn-g" onClick={() => navigate("/documents")}>← Zurück</button>
          {doc && (
            <>
              <h2 style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, flex: 1 }}>{(doc as any).name}</h2>
              <button className="btn btn-s btn-sm" onClick={handlePrint}>🖨 Drucken / PDF</button>
            </>
          )}
        </div>

        {isLoading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
            <span className="spin" style={{ width: 24, height: 24 }} /> Lädt …
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 20, color: "var(--err)" }}>
            Dokument konnte nicht geladen werden.
          </div>
        )}

        {doc && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>📋 Lebenslauf</h3>
              <div className="cv-wrap">
                <div className="cv-sheet" dangerouslySetInnerHTML={{ __html: (doc as any).cv_html || "" }} />
              </div>
            </div>

            {(doc as any).cover_letter && (
              <div>
                <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>✉️ Anschreiben</h3>
                <div className="card" style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8, color: "var(--text2)" }}>
                  {(doc as any).cover_letter}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
