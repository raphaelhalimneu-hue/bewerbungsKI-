import { Layout } from "../components/Layout";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { FiArrowRight, FiCheck, FiZap, FiLayout, FiGlobe, FiLinkedin, FiDownload, FiCamera } from "react-icons/fi";
import { useState } from "react";

// ── FAQ accordion ────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "16px 20px", cursor: "pointer",
        transition: "border-color .15s",
        borderColor: open ? "var(--brand)" : "var(--border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{q}</span>
        <span style={{ color: "var(--brand)", fontSize: 18, flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </div>
      {open && <p style={{ marginTop: 10, fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{a}</p>}
    </div>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      background: "var(--bg2)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "20px 18px",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: "var(--brand-l)", color: "var(--brand)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, marginBottom: 12,
      }}>
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

export default function Home() {
  const { t, i18n } = useTranslation();

  const features = [
    { icon: <FiLayout />, title: t("home.feat1Title"), desc: t("home.feat1Desc") },
    { icon: <FiZap />,    title: t("home.feat2Title"), desc: t("home.feat2Desc") },
    { icon: <FiGlobe />,  title: t("home.feat3Title"), desc: t("home.feat3Desc") },
    { icon: <FiLinkedin />,title: t("home.feat4Title"), desc: t("home.feat4Desc") },
    { icon: <FiDownload />,title: t("home.feat5Title"), desc: t("home.feat5Desc") },
    { icon: <FiCamera />, title: t("home.feat6Title"), desc: t("home.feat6Desc") },
  ];

  const faqs = [1, 2, 3, 4].map(n => ({ q: t(`home.faq${n}Q`), a: t(`home.faq${n}A`) }));

  return (
    <Layout>
      {/* ── HERO ── */}
      <div className="fade" style={{ textAlign: "center", padding: "12px 0 48px" }}>
        {/* Free badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#dcfce7", color: "#15803d",
          borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 700,
          marginBottom: 22, border: "1px solid #bbf7d0",
        }}>
          🎁 {t("home.freeBadge")}
        </div>

        <h1 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(30px,5.5vw,54px)",
          fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15,
          marginBottom: 18,
        }}>
          {t("home.titlePre")} <em style={{ color: "var(--brand)", fontStyle: "normal" }}>{t("home.titleEm")}</em>
        </h1>

        <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "var(--muted)", maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.65 }}>
          {t("home.subtitle")}
        </p>

        {i18n.resolvedLanguage !== "de" && (
          <p style={{ fontSize: 13, color: "var(--brand)", fontWeight: 600, marginBottom: 16 }}>
            {t("home.germanNote")}
          </p>
        )}

        <Link href="/wizard">
          <button className="btn btn-p btn-lg" style={{ fontSize: 16, padding: "15px 36px" }}>
            {t("home.cta")} <FiArrowRight />
          </button>
        </Link>

        {/* Trust strip */}
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center",
          gap: "10px 24px", marginTop: 22,
        }}>
          {[t("home.trustFree"), t("home.trustNoCard"), t("home.trustGdpr"), t("home.trustFast")].map(label => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--muted)" }}>
              <FiCheck style={{ color: "var(--ok)", flexShrink: 0 }} /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 700,
          textAlign: "center", marginBottom: 32, letterSpacing: "-.01em",
        }}>
          {t("home.howTitle")}
        </h2>
        <div className="grid3">
          {[1, 2, 3].map(n => (
            <div key={n} className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "var(--brand)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, marginBottom: 4,
              }}>
                {n}
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 15 }}>{t(`home.step${n}Title`)}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{t(`home.step${n}Text`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 700,
          textAlign: "center", marginBottom: 32, letterSpacing: "-.01em",
        }}>
          {t("home.featTitle")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {features.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: 680, margin: "0 auto 64px" }}>
        <h2 style={{
          fontFamily: "var(--fd)", fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 700,
          textAlign: "center", marginBottom: 24, letterSpacing: "-.01em",
        }}>
          {t("home.faqTitle")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqs.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section style={{
        background: "linear-gradient(135deg, var(--brand) 0%, #0ea5e9 100%)",
        borderRadius: 20, padding: "48px 32px", textAlign: "center",
        marginBottom: 32, color: "#fff",
        boxShadow: "0 8px 32px rgba(26,86,219,.25)",
      }}>
        <h2 style={{ fontFamily: "var(--fd)", fontSize: "clamp(22px,4vw,36px)", fontWeight: 700, marginBottom: 12, letterSpacing: "-.01em" }}>
          {t("home.ctaBottomTitle")}
        </h2>
        <p style={{ fontSize: 16, opacity: .88, marginBottom: 28 }}>
          {t("home.ctaBottomSub")}
        </p>
        <Link href="/wizard">
          <button style={{
            background: "#fff", color: "var(--brand)",
            border: "none", borderRadius: 14, padding: "14px 36px",
            fontSize: 16, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,.15)", transition: "transform .15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "none")}
          >
            {t("home.ctaBottom")} <FiArrowRight />
          </button>
        </Link>
      </section>
    </Layout>
  );
}
