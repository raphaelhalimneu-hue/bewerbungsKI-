import { Layout } from "../components/Layout";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { FiCheck, FiArrowRight } from "react-icons/fi";

export default function Home() {
  const { t, i18n } = useTranslation();
  return (
    <Layout>
      <div className="hero fade">
        <div className="hero-badge">
          {t("home.badge")}
        </div>
        <h1 className="hero-title">
          {t("home.titlePre")} <em>{t("home.titleEm")}</em>
        </h1>
        <p className="hero-sub">
          {t("home.subtitle")}
        </p>

        {i18n.resolvedLanguage !== "de" && (
          <p className="text-sm text-[var(--brand)] font-medium mb-4">
            {t("home.germanNote")}
          </p>
        )}

        <div className="feats">
          <div className="feat"><FiCheck className="ok" /> {t("home.feat1")}</div>
          <div className="feat"><FiCheck className="ok" /> {t("home.feat2")}</div>
          <div className="feat"><FiCheck className="ok" /> {t("home.feat3")}</div>
        </div>

        <Link href="/wizard">
          <button className="btn btn-p btn-lg">
            {t("home.cta")} <FiArrowRight />
          </button>
        </Link>
      </div>

      <div className="grid3 mt-12 fade" style={{ animationDelay: "0.1s" }}>
        {[1, 2, 3].map(n => (
          <div key={n} className="card text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--brand-l)] text-[var(--brand)] flex items-center justify-center text-xl mb-2">
              {n}
            </div>
            <h3 className="font-bold text-lg">{t(`home.step${n}Title`)}</h3>
            <p className="text-sm text-[var(--text2)]">{t(`home.step${n}Text`)}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
}
