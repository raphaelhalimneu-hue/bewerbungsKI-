import { Layout } from "../components/Layout";
import { ExampleCVShowcase } from "./Home";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useCreateCheckout } from "@workspace/api-client-react";

export default function Pricing() {
  const { user, profile, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const checkoutMutation = useCreateCheckout();

  async function handleUpgrade(plan: "single" | "starter" | "premium" | "power" = "premium") {
    if (!user) { setShowAuthModal(true); return; }
    try {
      toast({ title: t("pricing.redirect") });
      const res = await checkoutMutation.mutateAsync({ data: { plan } });
      if ((res as any).url) window.location.href = (res as any).url;
    } catch (e: any) {
      toast({ title: t("pricing.errorTitle"), description: e.message, variant: "destructive" });
    }
  }

  const freeFeats = [t("pricing.freeFeat1"), t("pricing.freeFeat2"), t("pricing.freeFeat3"), t("pricing.freeFeat4")];
  const premFeats = [t("pricing.premFeat1"), t("pricing.premFeat6"), t("pricing.premFeat2"), t("pricing.premFeat3"), t("pricing.premFeat4"), t("pricing.premFeat5")];
  const powerFeats = [t("pricing.powerFeat1"), t("pricing.powerFeat2"), t("pricing.premFeat2"), t("pricing.premFeat4"), t("pricing.premFeat5")];

  return (
    <Layout>
      <div className="fade">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: "var(--fd)", fontSize: "clamp(28px,5vw,48px)", fontWeight: 700, letterSpacing: "-.02em", marginBottom: 12 }}>
            {t("pricing.title")}
          </h1>
          <p style={{ fontSize: 17, color: "var(--muted)" }}>{t("pricing.subtitle")}</p>
        </div>

        <div style={{ maxWidth: 1020, margin: "0 auto", gap: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
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

          {/* Single application */}
          <div className="pc">
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 16 }}>{t("pricing.single")}</div>
            <div className="price-num">{t("pricing.singlePrice")}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{t("pricing.singleOneTime")}</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.singleFeat1")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.premFeat2")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.premFeat3")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.premFeat4")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.premFeat5")}</li>
            </ul>
            <button className="btn btn-s btn-full btn-lg" onClick={() => handleUpgrade("single")} disabled={checkoutMutation.isPending}>
              {checkoutMutation.isPending ? <span className="spin" /> : null}{t("pricing.buySingle")}
            </button>
          </div>

          {/* Starter bundle */}
          <div className="pc">
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 16 }}>{t("pricing.starter")}</div>
            <div className="price-num">{t("pricing.starterPrice")}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{t("pricing.starterOneTime")}</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.starterFeat1")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.starterFeat6")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.premFeat2")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.premFeat3")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.premFeat4")}</li>
              <li style={{ display: "flex", gap: 10, fontSize: 14 }}><span style={{ color: "var(--ok)" }}>✓</span>{t("pricing.premFeat5")}</li>
            </ul>
            <button className="btn btn-s btn-full btn-lg" onClick={() => handleUpgrade("starter")} disabled={checkoutMutation.isPending}>
              {checkoutMutation.isPending ? <span className="spin" /> : null}{t("pricing.buyStarter")}
            </button>
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
                    onClick={() => handleUpgrade("premium")}
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

          {/* Power — 50 applications */}
          <div className="pc">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("pricing.power")}</div>
              <span className="tag tag-w">{t("pricing.bestValue")}</span>
            </div>
            <div className="price-num">{t("pricing.powerPrice")}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{t("pricing.oneTimePower")}</div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {powerFeats.map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                  <span style={{ color: "var(--ok)", flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            {(profile as any)?.is_unlimited ? (
              <div style={{ background: "#dcfce7", color: "var(--ok)", borderRadius: 10, padding: "12px 20px", textAlign: "center", fontWeight: 600, fontSize: 14 }}>
                {t("pricing.premiumActive")}
              </div>
            ) : (
              <button
                className="btn btn-p btn-full btn-lg"
                onClick={() => handleUpgrade("power")}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? <span className="spin" /> : null}
                {checkoutMutation.isPending ? t("pricing.loading") : t("pricing.upgradeNow")}
              </button>
            )}
          </div>
        </div>

        <section style={{ maxWidth: 920, margin: "44px auto 0", padding: "28px 20px 24px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 18, textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 700, marginBottom: 10, letterSpacing: "-.01em" }}>
            {t("home.socialProofTitle")}
          </h2>
          <p style={{ color: "var(--brand)", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{t("home.socialProofText")}</p>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 22 }}>{t("home.socialProofNote")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, alignItems: "start" }}>
            <img src="/facebook-comments.jpg" alt={t("home.socialProofCommentsAlt")} loading="lazy" style={{ width: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 12, background: "var(--bg)" }} />
            <img src="/google-reactions.jpg" alt={t("home.socialProofCommentsAlt")} loading="lazy" style={{ width: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 12, background: "var(--bg)" }} />
          </div>
        </section>

        <section style={{ maxWidth: 920, margin: "44px auto 0" }}>
          <h2 style={{ fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 700, marginBottom: 12, letterSpacing: "-.01em", textAlign: "center" }}>
            {t("home.ba.title")}
          </h2>
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 14, marginBottom: 28 }}>
            {t("home.ba.subtitle")}
          </p>
          <ExampleCVShowcase />
        </section>

        <p style={{ textAlign: "center", marginTop: 28, fontSize: 13, color: "var(--muted)" }}>
          {t("pricing.questions")}
        </p>
      </div>
    </Layout>
  );
}
