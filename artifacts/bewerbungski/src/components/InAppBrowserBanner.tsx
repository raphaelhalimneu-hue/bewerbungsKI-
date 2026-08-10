import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiCopy, FiX } from "react-icons/fi";

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(ua);
}

export function InAppBrowserBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("fbBannerDismissed") === "1";
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);

  if (dismissed || !isInAppBrowser()) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href.split("?")[0]!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked */
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem("fbBannerDismissed", "1");
    } catch {
      /* private mode */
    }
  }

  return (
    <div
      className="shrink-0 flex items-center gap-2 px-4 py-2 text-[13px] leading-snug"
      style={{ background: "#fef3c7", color: "#92400e", borderBottom: "1px solid #fcd34d" }}
    >
      <FiAlertTriangle size={16} className="shrink-0" />
      <span className="flex-1">{t("fbBrowser.warning")}</span>
      <button
        onClick={copyLink}
        className="shrink-0 flex items-center gap-1 rounded px-2 py-1 font-medium"
        style={{ background: "#fde68a" }}
      >
        <FiCopy size={13} /> {copied ? t("fbBrowser.copied") : t("fbBrowser.copy")}
      </button>
      <button onClick={dismiss} aria-label={t("fbBrowser.close")} className="shrink-0 p-1">
        <FiX size={16} />
      </button>
    </div>
  );
}
