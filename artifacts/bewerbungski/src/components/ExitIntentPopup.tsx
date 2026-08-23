import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { appBase, pathLang, pathForLang } from "../lib/basePath";

const STORAGE_KEY = "exitPopupShownAt";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Minimum pixels scrolled down before a mobile upward-swipe can trigger the popup.
const MIN_SCROLL_DEPTH_PX = 300;
// Upward scroll velocity (px/s) required to trigger on mobile.
const UP_VELOCITY_THRESHOLD = 500;

function hasShownRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < SEVEN_DAYS_MS;
  } catch {
    return false;
  }
}

function markShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // private / storage-full – ignore
  }
}

function isMobile(): boolean {
  // Touch capability is the most reliable proxy for "no mouse".
  return typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

/**
 * Exit-intent popup.
 *
 * Desktop  – fires when the mouse leaves the page through the top edge.
 * Mobile   – fires when the user either:
 *              a) fast-scrolls upward after having scrolled down at least 300 px, or
 *              b) navigates away / puts the tab in the background (visibilitychange).
 *
 * Shown at most once every 7 days (localStorage). Never shown to premium users.
 */
export function ExitIntentPopup() {
  const { t } = useTranslation();
  const { profile } = useAuth() as any;
  const [visible, setVisible] = useState(false);
  const triggered = useRef(false);

  function tryTrigger() {
    if (triggered.current) return;
    if (hasShownRecently()) return;
    triggered.current = true;
    markShown();
    setVisible(true);
  }

  function dismiss() {
    setVisible(false);
  }

  useEffect(() => {
    // Never show to premium users.
    if (profile?.is_premium) return;

    if (!isMobile()) {
      // ── Desktop: mouse leaves through the top ──────────────────────────────
      const onMouseLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) tryTrigger();
      };
      document.addEventListener("mouseleave", onMouseLeave);
      return () => document.removeEventListener("mouseleave", onMouseLeave);
    } else {
      // ── Mobile: fast upward scroll OR tab backgrounded ────────────────────
      let prevY = window.scrollY;
      let prevTime = Date.now();
      let maxScrollY = window.scrollY;

      const onScroll = () => {
        const y = window.scrollY;
        const now = Date.now();
        const dt = now - prevTime;

        maxScrollY = Math.max(maxScrollY, y);

        if (dt > 0) {
          const dy = prevY - y; // positive when scrolling up
          if (dy > 0) {
            const velocity = (dy / dt) * 1000; // px per second
            if (maxScrollY >= MIN_SCROLL_DEPTH_PX && velocity >= UP_VELOCITY_THRESHOLD) {
              tryTrigger();
            }
          }
        }

        prevY = y;
        prevTime = now;
      };

      const onVisibility = () => {
        if (document.visibilityState === "hidden") tryTrigger();
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }
    // profile?.is_premium is the only dep that matters; we intentionally omit
    // tryTrigger from the dep array because it is a stable ref-based helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.is_premium]);

  if (!visible) return null;

  // Build the CTA href: preserve current language prefix, go to /wizard.
  const lang = pathLang();
  const wizardHref = lang
    ? `${appBase}/${lang}/wizard`
    : `${appBase}/wizard`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("exitPopup.title")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={dismiss}
    >
      <div
        style={{
          background: "var(--card, #ffffff)",
          color: "var(--foreground, #111)",
          borderRadius: "18px",
          padding: "36px 28px 28px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Hand emoji as a friendly "wait" signal */}
        <div style={{ fontSize: "38px", marginBottom: "12px", lineHeight: 1 }}>✋</div>

        <h2
          style={{
            fontFamily: "var(--fd, inherit)",
            fontSize: "21px",
            fontWeight: 800,
            marginBottom: "12px",
            lineHeight: 1.25,
          }}
        >
          {t("exitPopup.title")}
        </h2>

        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "var(--muted-foreground, #666)",
            marginBottom: "24px",
          }}
        >
          {t("exitPopup.text")}
        </p>

        <a
          href={wizardHref}
          className="btn btn-p"
          style={{
            display: "block",
            marginBottom: "12px",
            textDecoration: "none",
            textAlign: "center",
          }}
          onClick={dismiss}
        >
          {t("exitPopup.cta")}
        </a>

        <button
          style={{
            background: "none",
            border: "none",
            color: "var(--muted-foreground, #999)",
            fontSize: "14px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
          onClick={dismiss}
        >
          {t("exitPopup.dismiss")}
        </button>
      </div>
    </div>
  );
}
