import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "../context/AuthContext";

/** 5-star app rating with optional comment. Hidden once the user has rated. */
export function RatingCard() {
  const { t } = useTranslation();
  const { session } = useAuth() as any;
  const [existing, setExisting] = useState<any>(undefined); // undefined = loading
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!session) return;
    customFetch<any>("/api/ratings/me")
      .then(r => setExisting(r))
      .catch(() => setExisting(null));
  }, [!!session]);

  if (!session || existing === undefined || existing) return null;
  if (done) {
    return (
      <div className="card" style={{ marginTop: 28, textAlign: "center", padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>💙 {t("rating.thanks")}</div>
      </div>
    );
  }
  return renderCard();

  function renderCard() {
    return (
      <div className="card" style={{ marginTop: 28, padding: 20 }}>
        <div style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          ⭐ {t("rating.title")}
        </div>
        <div style={{ fontSize: 30, letterSpacing: 4, cursor: "pointer", marginBottom: 10, userSelect: "none" }}>
          {[1, 2, 3, 4, 5].map(n => (
            <span
              key={n}
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{ opacity: (hover || stars) >= n ? 1 : 0.25 }}
            >
              ⭐
            </span>
          ))}
        </div>
        {stars > 0 && (
          <>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t("rating.commentPlaceholder")}
              maxLength={2000}
              style={{ width: "100%", minHeight: 70, border: "1px solid var(--border)", borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }}
            />
            <button
              className="btn btn-p btn-sm"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                try {
                  await customFetch("/api/ratings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stars, comment: comment.trim() || null }),
                  });
                  setDone(true);
                } catch (e) {
                  console.error("Rating failed", e);
                } finally {
                  setSending(false);
                }
              }}
            >
              {sending ? <span className="spin" /> : null} {t("rating.send")}
            </button>
          </>
        )}
      </div>
    );
  }
}
