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
  const { user, profile, setShowAuthModal } = useAuth();
  const p = profile as any;
  const locked = !!user && !!p && !p.is_premium && (p.credits || 0) === 0 && (p.documents_count || 0) >= 1;
  const [mode, setMode] = useState<"cv" | "letter">("cv");
  const [cvText, setCvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [perfecting, setPerfecting] = useState(false);
  const [perfectChanges, setPerfectChanges] = useState<string[] | null>(null);
  const [perfectedText, setPerfectedText] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<UploadedFile | null>(null);
  const [wizardBusy, setWizardBusy] = useState(false);

  async function goWizard() {
    try { sessionStorage.setItem("bk_prefill_text", cvText.trim()); } catch { /* ignore */ }
    // If a file (PDF/photo) was uploaded, copy its design too
    if (lastFile) {
      setWizardBusy(true);
      try {
        const style = await customFetch("/api/design", {
          method: "POST",
          body: JSON.stringify({ mimeType: lastFile.mimeType, data: lastFile.base64 }),
        });
        if (style && typeof (style as any).accent === "string") {
          sessionStorage.setItem("bk_prefill_style", JSON.stringify(style));
        }
      } catch { /* design copy is best-effort */ }
      setWizardBusy(false);
    }
    navigate("/wizard");
  }

  async function runPerfect() {
    if (!user) { setShowAuthModal(true); return; }
    if (cvText.trim().length < 80) { setErrorMsg(t("scanner.tooShort")); return; }
    setErrorMsg(""); setPerfecting(true); setPerfectChanges(null);
    try {
      const res: any = await customFetch("/api/perfect", {
        method: "POST",
        body: JSON.stringify({
          letterText: cvText.trim(),
          docType: mode,
          language: i18n.resolvedLanguage || "de",
        }),
      });
      if (res?.letter) {
        setCvText(res.letter);
        setPerfectedText(res.letter);
        setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
        setResult(null);
        setPerfecting(false);
        void analyze(res.letter);
      } else {
        setErrorMsg(t("scanner.error"));
      }
    } catch (e: any) {
      setErrorMsg(e?.data?.error === "daily_limit_reached" ? t("scanner.dailyLimit") : e?.data?.error === "perfect_limit_reached" ? t("scanner.perfectLimit") : t("scanner.error"));
    } finally {
      setPerfecting(false);
    }
  }

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
        // Check automatically, since there is no separate check button anymore
        void analyze(pre);
      }
    } catch { /* ignore */ }
  }, []);

  async function analyze(textOverride?: string) {
    if (!user) { setShowAuthModal(true); return; }
    if (locked) return;
    const text = (textOverride ?? cvText).trim();
    if (text.length < 80) { setErrorMsg(t("scanner.tooShort")); return; }
    setErrorMsg(""); setBusy(true); setResult(null);
    try {
      const res = await customFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          cvText: text,
          docType: mode,
          language: i18n.resolvedLanguage || "de",
        }),
      });
      setResult(res as AnalyzeResult);
    } catch (e: any) {
      const code = (e as any)?.data?.error;
      if (code === "upgrade_required") { navigate("/pricing"); return; }
      setErrorMsg(code === "daily_limit_reached" ? t("scanner.dailyLimit") : t("scanner.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px 60px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>🔎 {mode === "letter" ? t("scanner.letterTitle") : t("scanner.title")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 16 }}>{mode === "letter" ? t("scanner.letterSubtitle") : t("scanner.subtitle")}</p>

        {locked && (
          <div className="card" style={{ marginBottom: 16, textAlign: "center", padding: "26px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{t("locked.title")}</div>
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{t("locked.text")}</p>
            <button className="btn btn-p" onClick={() => navigate("/pricing")}>{t("locked.cta")}</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["cv", "letter"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); setErrorMsg(""); setPerfectedText(null); setPerfectChanges(null); }}
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
            <FileImportButton onText={(txt) => { setCvText(txt); setErrorMsg(""); setResult(null); setPerfectedText(null); setPerfectChanges(null); }} onFile={setLastFile} />
          </div>
          <textarea
            value={cvText}
            onChange={(e) => { setCvText(e.target.value); if (errorMsg) setErrorMsg(""); }}
            placeholder={mode === "letter" ? t("scanner.letterPlaceholder") : t("scanner.cvPlaceholder")}
            rows={10}
            style={{ width: "100%", resize: "vertical", fontSize: 13.5, lineHeight: 1.6, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }}
          />
          {errorMsg && <div style={{ color: "var(--err)", fontSize: 13.5, marginTop: 10 }}>{errorMsg}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn btn-p" onClick={() => (locked ? navigate("/pricing") : analyze())} disabled={busy || perfecting || cvText.trim().length < 80} style={locked ? { opacity: 0.6 } : undefined}>
              {busy ? <><span className="spin" /> {t("scanner.analyzing")}</> : <>{locked ? "🔒 " : ""}{t("scanner.analyze")}</>}
            </button>
            <button className="btn btn-g" onClick={runPerfect} disabled={busy || perfecting || cvText.trim().length < 80}>
              {perfecting ? <><span className="spin" /> {t("preview.perfecting")}</> : <>✨ {t("preview.perfectBtn")}</>}
            </button>
            {cvText.trim().length >= 80 && (
              <button className="btn btn-g" onClick={goWizard} disabled={wizardBusy}>
                {wizardBusy ? <span className="spin" /> : "📝"} {t("scanner.useAsTemplate")}
              </button>
            )}
          </div>
        </div>

        {perfectedText && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>✨ {t("scanner.improvedTitle")}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.7, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
              {perfectedText}
            </div>
          </div>
        )}

        {perfectChanges && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>✅ {t("preview.perfectDone")}</div>
            {perfectChanges.length > 0 && (
              <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                {perfectChanges.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            )}
          </div>
        )}

        {result && <AnalysisCard result={result} />}
      </div>
    </Layout>
  );
}
