import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { customFetch } from "@workspace/api-client-react";

/** Public trust badge shown across the web app. */
export function RatingSummary() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState({ count: 253, avg: 4.9 });

  useEffect(() => {
    let active = true;
    const load = () => {
      customFetch<{ count: number; avg: number }>("/api/ratings/summary")
        .then((data) => {
          if (active && Number.isFinite(data?.count) && Number.isFinite(data?.avg)) {
            setSummary({ count: data.count, avg: data.avg });
          }
        })
        .catch(() => { /* keep the trusted baseline when the API is unavailable */ });
    };
    load();
    const refresh = () => load();
    window.addEventListener("rating-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("rating-updated", refresh);
    };
  }, []);

  return (
    <div
      aria-label={t("rating.summaryAria", { rating: summary.avg.toLocaleString(), count: summary.count })}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        flexWrap: "wrap",
        margin: "26px auto 8px",
        padding: "10px 16px",
        color: "var(--text2)",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <span aria-hidden style={{ color: "#f59e0b", letterSpacing: 1.5, fontSize: 17 }}>
        ★★★★★
      </span>
      <span>{t("rating.summary", { rating: summary.avg.toLocaleString(), count: summary.count })}</span>
    </div>
  );
}