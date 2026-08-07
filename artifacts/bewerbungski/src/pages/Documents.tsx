import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useListDocuments, useDeleteDocument } from "@workspace/api-client-react";

export default function Documents() {
  const { user, setShowAuthModal } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { data: docs = [], refetch } = useListDocuments({ query: { enabled: !!user } as any });
  const deleteMutation = useDeleteDocument();

  async function handleDelete(id: string) {
    if (!confirm(t("docs.confirmDelete"))) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: t("docs.deleted") });
      refetch();
    } catch (e: any) {
      toast({ title: t("docs.deleteError"), description: e.message, variant: "destructive" });
    }
  }

  const templateIcon = (tpl: string) => tpl === "classic" ? "⚫" : tpl === "creative" ? "🎨" : "🔵";

  return (
    <Layout>
      <div className="fade">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--fd)", fontSize: 24, fontWeight: 700 }}>{t("docs.title")}</h2>
          <button className="btn btn-p" onClick={() => navigate("/wizard")}>{t("docs.newDoc")}</button>
        </div>

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
            {docs.map((doc: any) => (
              <div key={doc.id} className="card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 30, flexShrink: 0 }}>{templateIcon(doc.template)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{doc.name}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>📅 {new Date(doc.created_at).toLocaleDateString(i18n.resolvedLanguage || "de")}</span>
                    <span>🎨 {doc.template || "Modern"}</span>
                    {doc.job_title && <span>💼 {doc.job_title}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-s btn-sm" onClick={() => navigate(`/preview/${doc.id}`)}>{t("docs.view")}</button>
                  <button className="btn btn-d btn-sm" onClick={() => handleDelete(doc.id)}>{t("docs.delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
