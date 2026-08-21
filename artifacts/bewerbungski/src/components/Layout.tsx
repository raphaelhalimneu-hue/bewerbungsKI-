import React from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { AuthModal } from "./AuthModal";
import { VerifyEmailModal } from "./VerifyEmailModal";
import { InAppBrowserBanner } from "./InAppBrowserBanner";
import { RatingCard } from "./RatingCard";
import { LANGUAGES } from "../i18n";
import { appBase, pathForLang } from "../lib/basePath";
import { FiHome, FiPlusCircle, FiFileText, FiSun, FiMoon, FiLogOut, FiLogIn, FiGlobe, FiSearch, FiUpload, FiMenu, FiX } from "react-icons/fi";

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage || "de";

  function switchTo(code: string) {
    try { localStorage.setItem("i18nextLng", code); } catch { /* private mode */ }
    // Strip any existing language prefix, add the new one (German = root).
    window.location.assign(appBase + pathForLang(code) + window.location.search);
  }
  return (
    <div className="flex items-center gap-1.5" title={t("nav.language")}>
      <FiGlobe size={16} className="text-[var(--muted)] hidden sm:block" />
      <select
        className="select max-w-[84px] sm:max-w-[120px]"
        style={{ padding: "6px 26px 6px 8px", fontSize: 13, width: "auto", textOverflow: "ellipsis", cursor: "pointer" }}
        value={current}
        onChange={e => switchTo(e.target.value)}
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
  const [location, navigate] = useLocation();
  const { user, profile, signOut, setShowAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  // Close the mobile menu on navigation
  React.useEffect(() => { setMobileMenuOpen(false); }, [location]);

  const menuItems: { href: string; icon: React.ReactNode; label: string; active: boolean }[] = [
    { href: "/", icon: <FiHome size={18} />, label: t("nav.home"), active: location === "/" },
    { href: "/wizard", icon: <FiPlusCircle size={18} />, label: t("nav.createNew"), active: location.startsWith("/wizard") },
    { href: "/documents", icon: <FiFileText size={18} />, label: t("nav.myDocuments"), active: location.startsWith("/documents") || location.startsWith("/preview") },
    { href: "/scanner", icon: <FiSearch size={18} />, label: t("scanner.nav"), active: location.startsWith("/scanner") },
    { href: "/import", icon: <FiUpload size={18} />, label: t("importPage.nav"), active: location.startsWith("/import") },
  ];

  return (
    <div className="app flex flex-col h-screen overflow-hidden">
      <InAppBrowserBanner />
      {/* Navbar */}
      <header className="nav shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 bg-[var(--bg2)] border-b border-[var(--border)] h-[60px] shadow-[0_1px_4px_rgba(15,23,42,0.05)] z-50">
        <Link href="/" className="nav-brand no-underline shrink-0 whitespace-nowrap">
          Bewerbungs<span>KI</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="btn-g flex md:hidden items-center justify-center p-2 rounded-lg"
            aria-label={t("nav.menu")}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
          <LanguageSwitcher />
          <button onClick={toggleTheme} className="btn-g flex items-center justify-center p-2 rounded-lg" aria-label={t("nav.toggleTheme")} title={t("nav.toggleTheme")}>
            {theme === "light" ? <FiMoon size={18} /> : <FiSun size={18} />}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--text2)] hidden sm:block">
                {profile?.email || user.email}
              </span>
              <button onClick={signOut} className="btn-g flex items-center justify-center p-2 rounded-lg" title={t("nav.signOut")}>
                <FiLogOut size={18} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="btn btn-p btn-sm shrink-0" title={t("nav.signIn")}>
              <FiLogIn size={16} className="sm:hidden" />
              <span className="hidden sm:inline">{t("nav.signIn")}</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[60px] z-40" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <nav
            className="relative bg-[var(--bg2)] border-b border-[var(--border)] shadow-lg px-3 py-3 flex flex-col gap-1"
            onClick={e => e.stopPropagation()}
          >
            {menuItems.map(item => (
              <Link key={item.href} href={item.href}>
                <button className={`si w-full ${item.active ? "on" : ""}`}>
                  {item.icon} {item.label}
                </button>
              </Link>
            ))}
          </nav>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="sidebar hidden md:flex flex-col w-[240px] bg-[var(--bg2)] border-e border-[var(--border)] py-4 px-2.5 gap-1 overflow-y-auto shrink-0">
          <div className="sec-lbl">{t("nav.menu")}</div>
          <Link href="/">
            <button className={`si ${location === "/" ? "on" : ""}`}>
              <FiHome size={18} /> {t("nav.home")}
            </button>
          </Link>
          {menuItems.slice(1).map(item => (
            <Link key={item.href} href={item.href}>
              <button className={`si ${item.active ? "on" : ""}`}>
                {item.icon} {item.label}
              </button>
            </Link>
          ))}

        </aside>

        {/* Main content */}
        <main className="main flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 min-w-0">
          <div className="max-w-[880px] mx-auto min-w-0">
            {children}
            <RatingCard />
          </div>
        </main>
      </div>

      <AuthModal />
      <VerifyEmailModal />
    </div>
  );
}
