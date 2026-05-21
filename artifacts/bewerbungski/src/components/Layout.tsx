import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { AuthModal } from "./AuthModal";
import { FiHome, FiPlusCircle, FiFileText, FiStar, FiSun, FiMoon, FiLogOut } from "react-icons/fi";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, profile, signOut, setShowAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app flex flex-col h-screen overflow-hidden">
      {/* Navbar */}
      <header className="nav shrink-0 flex items-center justify-between px-6 bg-[var(--bg2)] border-b border-[var(--border)] h-[60px] shadow-[0_1px_4px_rgba(15,23,42,0.05)] z-50">
        <Link href="/" className="nav-brand no-underline">
          Bewerbungs<span>KI</span>
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="btn-g flex items-center justify-center p-2 rounded-lg" aria-label="Toggle Theme">
            {theme === "light" ? <FiMoon size={18} /> : <FiSun size={18} />}
          </button>
          
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--text2)] hidden sm:block">
                {profile?.email || user.email}
              </span>
              {profile?.is_premium && (
                <span className="tag tag-ok shrink-0">Premium</span>
              )}
              <button onClick={signOut} className="btn-g flex items-center justify-center p-2 rounded-lg" title="Abmelden">
                <FiLogOut size={18} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="btn btn-p btn-sm">
              Anmelden
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="sidebar hidden md:flex flex-col w-[240px] bg-[var(--bg2)] border-r border-[var(--border)] py-4 px-2.5 gap-1 overflow-y-auto shrink-0">
          <div className="sec-lbl">Menü</div>
          <Link href="/">
            <button className={`si ${location === "/" ? "on" : ""}`}>
              <FiHome size={18} /> Home
            </button>
          </Link>
          <Link href="/wizard">
            <button className={`si ${location.startsWith("/wizard") ? "on" : ""}`}>
              <FiPlusCircle size={18} /> Neu erstellen
            </button>
          </Link>
          <Link href="/documents">
            <button className={`si ${location.startsWith("/documents") || location.startsWith("/preview") ? "on" : ""}`}>
              <FiFileText size={18} /> Meine Dokumente
            </button>
          </Link>
          
          <div className="mt-auto pt-4">
            <Link href="/pricing">
              <button className={`si ${location === "/pricing" ? "on" : ""}`}>
                <FiStar size={18} className={profile?.is_premium ? "text-[var(--warn)]" : ""} /> 
                {profile?.is_premium ? "Premium aktiv" : "Premium holen"}
              </button>
            </Link>
            
            {!profile?.is_premium && (
              <div className="mt-3 p-4 bg-[var(--bg3)] rounded-[12px] border border-[var(--border)]">
                <div className="text-[13px] font-bold mb-1">Free-Plan</div>
                <div className="text-[12px] text-[var(--muted)] mb-3">
                  {profile?.documents_count || 0} / 1 Bewerbung
                </div>
                <div className="prog">
                  <div 
                    className="prog-fill" 
                    style={{ width: `${Math.min(100, ((profile?.documents_count || 0) / 1) * 100)}%` }}
                  />
                </div>
                {((profile?.documents_count || 0) >= 1) && (
                  <Link href="/pricing">
                    <button className="btn btn-p btn-sm btn-full mt-3">Upgrade</button>
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
