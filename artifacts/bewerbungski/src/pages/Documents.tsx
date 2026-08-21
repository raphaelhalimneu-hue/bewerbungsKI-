import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useListDocuments, useDeleteDocument } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";

export default function Documents() {
  const { user, profile, setShowAuthModal, refetchProfile } = useAuth();
  const p = profile as any;
  const [, navigate] = useLocation();
  const pA = profile as any;
  // Free trial: PDF stays free, Word (DOCX) requires a purchase
  const docxLocked = !!pA && !pA.is_premium && (pA.credits || 0) === 0;
  const freeLocked = Boolean(
    user &&
    !pA?.is_premium &&
    !pA?.is_unlimited &&
    Number(pA?.credits || 0) === 0 &&
    Number(pA?.documents_count || 0) >= 1,
  );
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { data: docs = [], refetch } = useListDocuments({ query: { enabled: !!user } as any });
  const deleteMutation = useDeleteDocument();
  const [downloading, setDownloading] = useState<string | null>(null); // "<docId>-<type>"

  async function handleDelete(id: string) {
    if (!confirm(t("docs.confirmDelete"))) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: t("docs.deleted") });
      refetch();
      refetchProfile();
    } catch (e: any) {
      toast({ title: t("docs.deleteError"), description: e.message, variant: "destructive" });
    }
  }

  async function downloadFile(docId: string, url: string, filename: string, key: string) {
    if (docxLocked && url.endsWith(".docx")) { navigate("/pricing"); return; }
    setDownloading(key);
    try {
      const blob = await customFetch<Blob>(url, { responseType: "blob" });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e: any) {
      if (e?.status === 403 || e?.data?.error === "download_limit_reached") { navigate("/pricing"); return; }
      toast({ title: t("docs.downloadError"), description: e.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  }

  function safeName(doc: any) {
    return (doc.name || "Dokument").replace(/[^a-zA-Z0-9\-_äöüÄÖÜß ]/g, "");
  }

  const templateIcon = (tpl: string) => ({ classic: "⚫", creative: "🎨", executive: "💼", minimal: "◻️", elegant: "✒️", bold: "⬛", compact: "📄" } as Record<string, string>)[tpl] || "🔵";
  const atsColor = (s: number) => s >= 70 ? "#059669" : s >= 45 ? "#d97706" : "#dc2626";

  return (
    <Layout>
      <div className="fade">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--fd)", fontSize: 24, fontWeight: 700 }}>{t("docs.title")}</h2>
          <button className="btn btn-p" onClick={() => navigate(freeLocked ? "/pricing" : "/wizard")}>
            {freeLocked ? "Upgrade" : t("docs.newDoc")}
          </button>
        </div>

        {user && typeof p?.document_limit === "number" && (() => {
          const limit = p.document_limit;
          const remaining = Math.max(0, limit - (p?.documents_count || 0));
          return (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px", marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                📊 {t("nav.remaining", { remaining, limit })}
              </span>
              {remaining <= 3 && (
                <button className="btn btn-p btn-sm" onClick={() => navigate("/pricing")}>
                  {t("nav.lowRemainingHint")}
                </button>
              )}
            </div>
          );
        })()}

        {freeLocked && (
          <div className="card" style={{ marginBottom: 16, borderColor: "var(--brand)", background: "#eff6ff" }}>
            <strong style={{ display: "block", marginBottom: 4 }}>Deine Bewerbung ist sicher gespeichert.</strong>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>
               Du kannst sie weiterhin ansehen. Für Bearbeitung, Drucken, Download und weitere Bewerbungen bitte freischalten.
            </span>
          </div>
        )}

        {!user ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>🔒</div>
            <h3 style={{ marginBottom: 8 }}>{t("docs.authRequired")}</h3>
            <p style={{ color: "var(--muted)", marginBottom: 20 }}>{t("docs.authText")}</p>
            <button className="btn btn-p btn-lg" onClick={() => setShowAuthModal(true)}>{t("docs.authBtn")}</button>
          </div>
        ) : docs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📭</div>
            <h3 style={{ marginBottom: 8 }}>{t("docs.emptyTitle")}</h3>
            <p style={{ color: "var(--muted)", marginBottom: 20 }}>{t("docs.emptyText")}</p>
            <button className="btn btn-p btn-lg" onClick={() => navigate("/wizard")}>{t("docs.emptyBtn")}</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {docs.map((doc: any) => {
              const busy = downloading !== null;
              return (
                <div key={doc.id} className="card" style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 30, flexShrink: 0, paddingTop: 2 }}>{templateIcon(doc.template)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{doc.name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>📅 {new Date(doc.created_at).toLocaleDateString(i18n.resolvedLanguage || "de")}</span>
                      <span>🎨 {doc.template || "Modern"}</span>
                      {doc.job_title && <span>💼 {doc.job_title}</span>}
                      {doc.ats_score?.score != null && (
                        <span style={{ color: atsColor(doc.ats_score.score), fontWeight: 700 }}>
                          🎯 ATS {doc.ats_score.score}%
                        </span>
                      )}
                    </div>
                    {!freeLocked && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      {/* CV downloads */}
                      {doc.has_cv !== false && (
                        <>
                          <button
                            className="btn btn-p btn-sm"
                            disabled={busy}
                            onClick={() => downloadFile(doc.id, `/api/documents/${doc.id}/download/cv.pdf`, `${safeName(doc)} – Lebenslauf.pdf`, `${doc.id}-cv-pdf`)}
                            title={t("docs.downloadCvPdf")}
                            style={{ fontSize: 12 }}
                          >
                            {downloading === `${doc.id}-cv-pdf` ? <><span className="spin" /> PDF…</> : <>⬇ CV PDF</>}
                          </button>
                          <button
                            className="btn btn-g btn-sm"
                            disabled={busy}
                            onClick={() => downloadFile(doc.id, `/api/documents/${doc.id}/download/cv.docx`, `${safeName(doc)} – Lebenslauf.docx`, `${doc.id}-cv-docx`)}
                            title={t("docs.downloadCvDocx")}
                            style={{ fontSize: 12 }}
                          >
                            {downloading === `${doc.id}-cv-docx` ? <><span className="spin" /> Word…</> : <>{docxLocked ? "🔒" : "⬇"} CV DOCX</>}
                          </button>
                        </>
                      )}
                      {/* Cover letter downloads (only if document has one) */}
                      {doc.has_cover_letter && (
                        <>
                          <button
                            className="btn btn-p btn-sm"
                            disabled={busy}
                            onClick={() => downloadFile(doc.id, `/api/documents/${doc.id}/download/cover-letter.pdf`, `${safeName(doc)} – Bewerbung.pdf`, `${doc.id}-letter-pdf`)}
                            title={t("docs.downloadLetterPdf")}
                            style={{ fontSize: 12 }}
                          >
                            {downloading === `${doc.id}-letter-pdf` ? <><span className="spin" /> PDF…</> : <>⬇ Bewerbung PDF</>}
                          </button>
                          <button
                            className="btn btn-g btn-sm"
                            disabled={busy}
                            onClick={() => downloadFile(doc.id, `/api/documents/${doc.id}/download/cover-letter.docx`, `${safeName(doc)} – Bewerbung.docx`, `${doc.id}-letter-docx`)}
                            title={t("docs.downloadLetterDocx")}
                            style={{ fontSize: 12 }}
                          >
                            {downloading === `${doc.id}-letter-docx` ? <><span className="spin" /> Word…</> : <>{docxLocked ? "🔒" : "⬇"} Bewerbung DOCX</>}
                          </button>
                        </>
                      )}
                    </div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, flexDirection: "column" }}>
                    <button className="btn btn-p btn-sm" onClick={() => navigate(freeLocked ? "/pricing" : `/documents/${doc.id}/edit`)} style={{ justifyContent: "center" }}>✏️ {t("docs.edit") || "Bearbeiten"}</button>
                    <button className="btn btn-s btn-sm" onClick={() => navigate(`/preview/${doc.id}`)} style={{ justifyContent: "center" }}>{t("docs.view")}</button>
                    {!freeLocked && <button className="btn btn-d btn-sm" onClick={() => handleDelete(doc.id)} style={{ justifyContent: "center" }}>{t("docs.delete")}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
