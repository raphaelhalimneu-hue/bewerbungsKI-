import React from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { AuthModal } from "./AuthModal";
import { LANGUAGES } from "../i18n";
import { FiHome, FiPlusCircle, FiFileText, FiStar, FiSun, FiMoon, FiLogOut, FiGlobe } from "react-icons/fi";

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage || "de";
  return (
    <div className="flex items-center gap-1.5" title={t("nav.language")}>
      <FiGlobe size={16} className="text-[var(--muted)] hidden sm:block" />
      <select
        className="select"
        style={{ padding: "6px 8px", fontSize: 13, width: "auto", cursor: "pointer" }}
        value={current}
        onChange={e => i18n.changeLanguage(e.target.value)}
        aria-label={t("nav.language")}
      >
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, profile, signOut, setShowAuthModal } = useAuth();
  const p = profile as any;
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="app flex flex-col h-screen overflow-hidden">
      {/* Navbar */}
      <header className="nav shrink-0 flex items-center justify-between px-6 bg-[var(--bg2)] border-b border-[var(--border)] h-[60px] shadow-[0_1px_4px_rgba(15,23,42,0.05)] z-50">
        <Link href="/" className="nav-brand no-underline">
          Bewerbungs<span>KI</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={toggleTheme} className="btn-g flex items-center justify-center p-2 rounded-lg" aria-label={t("nav.toggleTheme")} title={t("nav.toggleTheme")}>
            {theme === "light" ? <FiMoon size={18} /> : <FiSun size={18} />}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--text2)] hidden sm:block">
                {p?.email || user.email}
              </span>
              {p?.is_premium && (
                <span className="tag tag-ok shrink-0">{t("nav.premium")}</span>
              )}
              <button onClick={signOut} className="btn-g flex items-center justify-center p-2 rounded-lg" title={t("nav.signOut")}>
                <FiLogOut size={18} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="btn btn-p btn-sm">
              {t("nav.signIn")}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="sidebar hidden md:flex flex-col w-[240px] bg-[var(--bg2)] border-e border-[var(--border)] py-4 px-2.5 gap-1 overflow-y-auto shrink-0">
          <div className="sec-lbl">{t("nav.menu")}</div>
          <Link href="/">
            <button className={`si ${location === "/" ? "on" : ""}`}>
              <FiHome size={18} /> {t("nav.home")}
            </button>
          </Link>
          <Link href="/wizard">
            <button className={`si ${location.startsWith("/wizard") ? "on" : ""}`}>
              <FiPlusCircle size={18} /> {t("nav.createNew")}
            </button>
          </Link>
          <Link href="/documents">
            <button className={`si ${location.startsWith("/documents") || location.startsWith("/preview") ? "on" : ""}`}>
              <FiFileText size={18} /> {t("nav.myDocuments")}
            </button>
          </Link>

          <div className="mt-auto pt-4">
            <Link href="/pricing">
              <button className={`si ${location === "/pricing" ? "on" : ""}`}>
                <FiStar size={18} className={p?.is_premium ? "text-[var(--warn)]" : ""} />
                {p?.is_premium ? t("nav.premiumActive") : t("nav.getPremium")}
              </button>
            </Link>

            {!p?.is_premium && (
              <div className="mt-3 p-4 bg-[var(--bg3)] rounded-[12px] border border-[var(--border)]">
                <div className="text-[13px] font-bold mb-1">{t("nav.freePlan")}</div>
                <div className="text-[12px] text-[var(--muted)] mb-3">
                  {t("nav.docCount", { count: p?.documents_count || 0 })}
                </div>
                <div className="prog">
                  <div
                    className="prog-fill"
                    style={{ width: `${Math.min(100, ((p?.documents_count || 0) / 1) * 100)}%` }}
                  />
                </div>
                {((p?.documents_count || 0) >= 1) && (
                  <Link href="/pricing">
                    <button className="btn btn-p btn-sm btn-full mt-3">{t("nav.upgrade")}</button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="main flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-[880px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      <AuthModal />
    </div>
  );
}
