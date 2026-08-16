import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { FileImportButton, type UploadedFile } from "../components/FileImportButton";

type AnalyzeResult = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: { title: string; tip: string }[];
};

export function scoreColor(score: number): string {
  return score >= 70 ? "#059669" : score >= 45 ? "#d97706" : "#dc2626";
}

export function AnalysisCard({ result }: { result: AnalyzeResult }) {
  const { t } = useTranslation();
  const col = scoreColor(result.score);
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ width: 76, height: 76, borderRadius: "50%", border: `6px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 21, color: col, flexShrink: 0 }}>
          {result.score}
        </div>
        <div style={{ flex: 1, minWidth: 220, fontSize: 14, lineHeight: 1.6 }}>{result.summary}</div>
      </div>
      {result.strengths?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>✅ {t("scanner.strengths")}</div>
          <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13.5, lineHeight: 1.7, color: "var(--text2)" }}>
            {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {result.improvements?.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>💡 {t("scanner.improvements")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.improvements.map((imp, i) => (
              <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>{imp.title}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{imp.tip}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Scanner() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const { user, setShowAuthModal } = useAuth();
  const [mode, setMode] = useState<"cv" | "letter">("cv");
  const [cvText, setCvText] = useState("");
  const [jobText, setJobText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastFile, setLastFile] = useState<UploadedFile | null>(null);
  const [styleBusy, setStyleBusy] = useState(false);

  // Prefill from the Import page
  useEffect(() => {
    try {
      const pre = sessionStorage.getItem("bk_scan_text");
      const m = sessionStorage.getItem("bk_scan_mode");
      if (pre) {
        setCvText(pre);
        if (m === "letter" || m === "cv") setMode(m);
        sessionStorage.removeItem("bk_scan_text");
        sessionStorage.removeItem("bk_scan_mode");
      }
    } catch { /* ignore */ }
  }, []);

  async function useStyle() {
    if (!lastFile || styleBusy) return;
    setErrorMsg(""); setStyleBusy(true);
    try {
      const res: any = await customFetch("/api/design", {
        method: "POST",
        body: JSON.stringify({ filename: lastFile.filename, mimeType: lastFile.mimeType, data: lastFile.base64 }),
      });
      if (res?.accent) {
        try { sessionStorage.setItem("bk_prefill_style", JSON.stringify(res)); } catch { /* ignore */ }
        navigate("/wizard");
      } else {
        setErrorMsg(t("scanner.styleError"));
      }
    } catch {
      setErrorMsg(t("scanner.styleError"));
    } finally {
      setStyleBusy(false);
    }
  }

  async function analyze() {
    if (!user) { setShowAuthModal(true); return; }
    if (cvText.trim().length < 80) { setErrorMsg(t("scanner.tooShort")); return; }
    setErrorMsg(""); setBusy(true); setResult(null);
    try {
      const res = await customFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          cvText: cvText.trim(),
          docType: mode,
          jobText: jobText.trim() || undefined,
          language: i18n.resolvedLanguage || "de",
        }),
      });
      setResult(res as AnalyzeResult);
    } catch {
      setErrorMsg(t("scanner.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px 60px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>🔎 {mode === "letter" ? t("scanner.letterTitle") : t("scanner.title")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 16 }}>{mode === "letter" ? t("scanner.letterSubtitle") : t("scanner.subtitle")}</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["cv", "letter"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); setErrorMsg(""); }}
              className="btn"
              style={{
                fontWeight: 700, fontSize: 13.5, padding: "8px 16px", borderRadius: 999,
                border: mode === m ? "2px solid var(--brand)" : "1px solid var(--border)",
                background: mode === m ? "var(--brand)" : "var(--bg2)",
                color: mode === m ? "#fff" : "var(--text)",
              }}
            >
              {m === "cv" ? t("scanner.modeCv") : t("scanner.modeLetter")}
            </button>
          ))}
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <label style={{ fontWeight: 700, fontSize: 14 }}>{mode === "letter" ? t("scanner.letterLabel") : t("scanner.cvLabel")}</label>
            <FileImportButton onText={(txt) => setCvText(txt)} onFile={(f) => setLastFile(f)} />
          </div>
          <textarea
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder={mode === "letter" ? t("scanner.letterPlaceholder") : t("scanner.cvPlaceholder")}
            rows={10}
            style={{ width: "100%", resize: "vertical", fontSize: 13.5, lineHeight: 1.6, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }}
          />
          <label style={{ fontWeight: 700, fontSize: 14, display: "block", margin: "16px 0 6px" }}>{t("scanner.jobLabel")}</label>
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder={t("scanner.jobPlaceholder")}
            rows={5}
            style={{ width: "100%", resize: "vertical", fontSize: 13.5, lineHeight: 1.6, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }}
          />
          {errorMsg && <div style={{ color: "var(--err)", fontSize: 13.5, marginTop: 10 }}>{errorMsg}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn btn-p" onClick={analyze} disabled={busy}>
              {busy ? <><span className="spin" /> {t("scanner.analyzing")}</> : t("scanner.analyze")}
            </button>
            {mode === "cv" && cvText.trim().length >= 80 && (
              <button
                className="btn btn-g"
                onClick={() => {
                  try { sessionStorage.setItem("bk_prefill_text", cvText.trim()); } catch { /* ignore */ }
                  navigate("/wizard");
                }}
              >
                📝 {t("scanner.useAsTemplate")}
              </button>
            )}
            {lastFile && (
              <button className="btn btn-g" onClick={useStyle} disabled={styleBusy}>
                {styleBusy ? <><span className="spin" /> {t("scanner.styleBusy")}</> : <>🎨 {t("scanner.useStyle")}</>}
              </button>
            )}
          </div>
        </div>

        {result && (
          <>
            <AnalysisCard result={result} />
            <div className="card" style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>🚀 {t("scanner.cta")}</div>
              <button className="btn btn-p" onClick={() => navigate("/wizard")}>{t("scanner.ctaBtn")}</button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
