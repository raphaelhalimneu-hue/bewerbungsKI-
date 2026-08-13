import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useCreateCheckout } from "@workspace/api-client-react";

export default function Pricing() {
  const { user, profile, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const checkoutMutation = useCreateCheckout();

  async function handleUpgrade() {
    if (!user) { setShowAuthModal(true); return; }
    try {
      toast({ title: t("pricing.redirect") });
      const res = await checkoutMutation.mutateAsync({ data: { plan: "premium" } });
      if ((res as any).url) window.location.href = (res as any).url;
    } catch (e: any) {
      toast({ title: t("pricing.errorTitle"), description: e.message, variant: "destructive" });
    }
  }

  const freeFeats = [t("pricing.freeFeat1"), t("pricing.freeFeat2"), t("pricing.freeFeat3"), t("pricing.freeFeat4")];
  const premFeats = [t("pricing.premFeat1"), t("pricing.premFeat2"), t("pricing.premFeat3"), t("pricing.premFeat4"), t("pricing.premFeat5")];

  return (
    <Layout>
      <div className="fade">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: "var(--fd)", fontSize: "clamp(28px,5vw,48px)", fontWeight: 700, letterSpacing: "-.02em", marginBottom: 12 }}>
            {t("pricing.title")}
          </h1>
          <p style={{ fontSize: 17, color: "var(--muted)" }}>{t("pricing.subtitle")}</p>
        </div>

        <div className="grid2" style={{ maxWidth: 700, margin: "0 auto", gap: 20 }}>
          {/* Free */}
          <div className="pc">
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 16 }}>{t("pricing.free")}</div>
            <div className="price-num" style={{ color: "var(--text)" }}>{t("pricing.freePrice")}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{t("pricing.freeForever")}</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {freeFeats.map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                  <span style={{ color: "var(--ok)", flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button className="btn btn-s btn-full" disabled>{t("pricing.currentPlan")}</button>
          </div>

          {/* Premium */}
          <div className="pc hot">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("pricing.premium")}</div>
              <span className="tag tag-w">{t("pricing.popular")}</span>
            </div>
            <div className="price-num">{t("pricing.premiumPrice")}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{t("pricing.oneTime")}</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {premFeats.map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                  <span style={{ color: "var(--ok)", flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            {(() => {
              const p = profile as any;
              const isPremium = !!p?.is_premium;
              const atLimit =
                isPremium &&
                typeof p?.documents_count === "number" &&
                typeof p?.document_limit === "number" &&
                p.documents_count >= p.document_limit;
              if (isPremium && !atLimit) {
                return (
                  <div style={{ background: "#dcfce7", color: "var(--ok)", borderRadius: 10, padding: "12px 20px", textAlign: "center", fontWeight: 600, fontSize: 14 }}>
                    {t("pricing.premiumActive")}
                  </div>
                );
              }
              return (
                <>
                  {atLimit && (
                    <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, textAlign: "center" }}>
                      {t("pricing.limitReachedHint")}
                    </p>
                  )}
                  <button
                    className="btn btn-p btn-full btn-lg"
                    onClick={handleUpgrade}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? <span className="spin" /> : null}
                    {checkoutMutation.isPending
                      ? t("pricing.loading")
                      : atLimit
                        ? t("pricing.buyMore")
                        : t("pricing.upgradeNow")}
                  </button>
                </>
              );
            })()}
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 28, fontSize: 13, color: "var(--muted)" }}>
          {t("pricing.questions")}
        </p>
      </div>
    </Layout>
  );
}
