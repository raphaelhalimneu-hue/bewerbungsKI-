import React, { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { FiX, FiGift } from "react-icons/fi";

const LS_KEY = "exitPopupShownAt";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // once per week

function recentlyShown(): boolean {
  try {
    const ts = Number(localStorage.getItem(LS_KEY) || 0);
    return Date.now() - ts < COOLDOWN_MS;
  } catch {
    return true; // private mode: don't nag
  }
}

export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const p = profile as any;

  const eligiblePage = location === "/" || location === "/pricing";
  const isPremium = !!p?.is_premium;

  useEffect(() => {
    if (!eligiblePage || isPremium || recentlyShown()) return;

    function onMouseOut(e: MouseEvent) {
      // Fires when the cursor leaves through the top of the viewport (desktop exit intent)
      if (e.relatedTarget || e.clientY > 10) return;
      try { localStorage.setItem(LS_KEY, String(Date.now())); } catch { /* ignore */ }
      setOpen(true);
      document.removeEventListener("mouseout", onMouseOut);
    }
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [eligiblePage, isPremium]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={t("exitPopup.title")}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-[var(--bg2)] border border-[var(--border)] p-6 shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 rtl:left-3 ltr:right-3 p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--bg)]"
          aria-label={t("exitPopup.dismiss")}
        >
          <FiX size={18} />
        </button>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent,#2563eb)]/10 text-[var(--accent,#2563eb)]">
          <FiGift size={24} />
        </div>
        <h3 className="text-lg font-bold mb-2">{t("exitPopup.title")}</h3>
        <p className="text-sm text-[var(--muted)] mb-5">{t("exitPopup.text")}</p>
        <Link
          href="/wizard"
          onClick={() => setOpen(false)}
          className="btn btn-p w-full justify-center no-underline"
        >
          {t("exitPopup.cta")}
        </Link>
        <button onClick={() => setOpen(false)} className="mt-3 text-xs text-[var(--muted)] underline bg-transparent border-0 cursor-pointer">
          {t("exitPopup.dismiss")}
        </button>
      </div>
    </div>
  );
}
