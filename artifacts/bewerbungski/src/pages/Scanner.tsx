import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { FileImportButton, type UploadedFile } from "../components/FileImportButton";
import { buildAnalyzeRequest, saveWizardDesign, saveWizardPrefill, takeScanImport } from "../lib/importHandoff";

type AnalyzeResult = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: { title: string; tip: string }[];
};

export function scoreColor(score: number): string {
  return score >= 70 ? "#059669" : score >= 45 ? "#d97706" : "#dc2626";
}

export function AnalysisCard({
  result,
  onImprove,
  improving = false,
}: {
  result: AnalyzeResult;
  onImprove?: () => void;
  improving?: boolean;
}) {
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
      {onImprove && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-p" onClick={onImprove} disabled={improving}>
            {improving ? <><span className="spin" /> {t("scanner.improving")}</> : <>✨ {t("scanner.improve")}</>}
          </button>
        </div>
      )}
    </div>
  );
}

function createClientPreview(text: string): string {
  const normalized = text.trim();
  if (!normalized) return "";
  const visibleLength = Math.max(1, Math.min(500, Math.max(24, Math.ceil(normalized.length * 0.35)), normalized.length - 1));
  return `${normalized.slice(0, visibleLength).trimEnd()} […]`;
}

export default function Scanner() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const { user, profile, setShowAuthModal } = useAuth();
  const p = profile as any;
  const [mode, setMode] = useState<"cv" | "letter">("cv");
  const [cvText, setCvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [perfecting, setPerfecting] = useState(false);
  const [perfectChanges, setPerfectChanges] = useState<string[] | null>(null);
  const [perfectedText, setPerfectedText] = useState<string | null>(null);
  const [perfectedLocked, setPerfectedLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastFile, setLastFile] = useState<UploadedFile | null>(null);
  const [wizardBusy, setWizardBusy] = useState(false);
  const cvInputRef = useRef<HTMLTextAreaElement>(null);
  const perfectedTextRef = useRef<HTMLDivElement>(null);
  // Match the server entitlement rule; a stale is_premium flag is not payment.
  const freeUser = !!p && !p.is_unlimited && Number(p.credits || 0) <= 0;
  const perfectedCopyLocked = perfectedLocked && !!perfectedText;

  function blockCopy(e: ClipboardEvent<HTMLElement>) {
    e.preventDefault();
  }

  // Capture copy/cut events globally because Android's selection toolbar does
  // not reliably bubble clipboard events from the preview.
  useEffect(() => {
    if (!perfectedCopyLocked) return;
    const isInside = (node: Node | null, container: HTMLElement | null) =>
      !!node && !!container && (node === container || container.contains(node));
    const isLockedTarget = (target: EventTarget | null) => {
      const node = target instanceof Node ? target : null;
      const active = document.activeElement;
      const selection = window.getSelection();
      return [
        node,
        active,
        selection?.anchorNode ?? null,
        selection?.focusNode ?? null,
      ].some((candidate) =>
        isInside(candidate, perfectedTextRef.current),
      );
    };
    const preventClipboard = (event: Event) => {
      if (isLockedTarget(event.target)) event.preventDefault();
    };
    const preventShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["c", "x"].includes(event.key.toLowerCase()) && isLockedTarget(event.target)) {
        event.preventDefault();
      }
    };
    document.addEventListener("copy", preventClipboard, true);
    document.addEventListener("cut", preventClipboard, true);
    document.addEventListener("keydown", preventShortcut, true);
    return () => {
      document.removeEventListener("copy", preventClipboard, true);
      document.removeEventListener("cut", preventClipboard, true);
      document.removeEventListener("keydown", preventShortcut, true);
    };
  }, [perfectedCopyLocked]);

  // Scanner generations are persisted server-side. A reload receives only the
  // preview for free accounts; after a purchase the same request returns full text.
  useEffect(() => {
    if (!user || !p) return;
    let cancelled = false;
    customFetch(`/api/perfect/latest?type=${mode}`)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.locked && typeof res.preview === "string") {
          setPerfectedText(res.preview);
          setPerfectedLocked(true);
          setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
        } else if (freeUser && typeof res?.letter === "string") {
          setPerfectedText(createClientPreview(res.letter));
          setPerfectedLocked(true);
          setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
        } else if (typeof res?.letter === "string") {
          setPerfectedText(res.letter);
          setPerfectedLocked(false);
          setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
          setCvText((current) => current || res.letter);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, p, freeUser, mode]);

  async function goWizard() {
    // Prefer the source text, but keep the improved result as a fallback when
    // the scanner view was populated only by a previous perfection run.
    // Never use a server-locked perfected preview as Wizard input. The Wizard
    // places imported text into a normal textarea, where it would become
    // copyable. An original scanner/import text is safe; a paid full result is
    // already allowed to be copied and can still be used here.
    const wizardText = cvText.trim().length >= 30
      ? cvText
      : (!perfectedLocked ? (perfectedText || "") : "");
    if (wizardText.trim().length < 30) {
      setErrorMsg(t("scanner.tooShort"));
      return;
    }
    try { saveWizardPrefill(sessionStorage, wizardText, mode); } catch { /* ignore */ }
    // If a file (PDF/photo) was uploaded, copy its design too
    if (lastFile) {
      setWizardBusy(true);
      try {
        const style = await customFetch("/api/design", {
          method: "POST",
          body: JSON.stringify({ mimeType: lastFile.mimeType, data: lastFile.base64 }),
        });
        saveWizardDesign(sessionStorage, style);
      } catch { /* design copy is best-effort */ }
      setWizardBusy(false);
    }
    navigate("/wizard");
  }

  async function runPerfect() {
    if (!user) { setShowAuthModal(true); return; }
    if (cvText.trim().length < 80) { setErrorMsg(t("scanner.tooShort")); return; }
    setErrorMsg(""); setPerfecting(true); setPerfectChanges(null); setCopied(false);
    try {
      const res: any = await customFetch("/api/perfect", {
        method: "POST",
        body: JSON.stringify({
          letterText: cvText.trim(),
          docType: mode,
          language: i18n.resolvedLanguage || "de",
        }),
      });
      if (res?.locked && typeof res.preview === "string") {
        setPerfectedText(res.preview);
        setPerfectedLocked(true);
        setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
        setResult(null);
      } else if (freeUser && typeof res?.letter === "string") {
        setPerfectedText(createClientPreview(res.letter));
        setPerfectedLocked(true);
        setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
        setResult(null);
      } else if (typeof res?.letter === "string") {
        setCvText(res.letter);
        setPerfectedText(res.letter);
        setPerfectedLocked(false);
        setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
        setResult(null);
        setPerfecting(false);
        void analyze(res.letter);
      } else {
        setErrorMsg(t("scanner.perfectError"));
      }
    } catch (e: any) {
      const code = e?.data?.error;
      setErrorMsg(code === "daily_limit_reached"
        ? t("scanner.dailyLimit")
        : code === "perfect_limit_reached"
          ? t("scanner.perfectLimit")
          : code === "busy_try_again"
            ? t("scanner.busyError")
            : t("scanner.perfectError"));
    } finally {
      setPerfecting(false);
    }
  }

  async function copyPerfectedText() {
    if (perfectedCopyLocked || !perfectedText) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(perfectedText);
      } else {
        const copyTarget = document.createElement("textarea");
        copyTarget.value = perfectedText;
        copyTarget.setAttribute("readonly", "");
        copyTarget.style.position = "fixed";
        copyTarget.style.opacity = "0";
        document.body.appendChild(copyTarget);
        copyTarget.select();
        const copiedSuccessfully = document.execCommand("copy");
        copyTarget.remove();
        if (!copiedSuccessfully) throw new Error("copy_failed");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setErrorMsg(t("scanner.copyError"));
    }
  }

  function usePerfectedText() {
    if (perfectedCopyLocked || !perfectedText) return;
    setCvText(perfectedText);
    setErrorMsg("");
    setCopied(false);
  }

  // Prefill from the Import page
  useEffect(() => {
    try {
      const imported = takeScanImport(sessionStorage);
      if (imported) {
        setCvText(imported.text);
        setMode(imported.mode);
        // Check automatically, since there is no separate check button anymore
        // Pass the imported mode directly: React state updates asynchronously.
        void analyze(imported.text, imported.mode);
      }
    } catch { /* ignore */ }
  }, []);

  async function analyze(textOverride?: string, modeOverride?: "cv" | "letter") {
    if (!user) { setShowAuthModal(true); return; }
    const text = (textOverride ?? cvText).trim();
    const analysisMode = modeOverride ?? mode;
    if (text.length < 80) { setErrorMsg(t("scanner.tooShort")); return; }
    setErrorMsg(""); setBusy(true); setResult(null);
    try {
      const res = await customFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify(buildAnalyzeRequest(text, analysisMode, i18n.resolvedLanguage || "de")),
      });
      setResult(res as AnalyzeResult);
    } catch (e: any) {
      const code = (e as any)?.data?.error;
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

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["cv", "letter"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); setErrorMsg(""); setPerfectedText(null); setPerfectedLocked(false); setPerfectChanges(null); setCopied(false); }}
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
            <FileImportButton onText={(txt) => { setCvText(txt); setErrorMsg(""); setResult(null); setPerfectedText(null); setPerfectedLocked(false); setPerfectChanges(null); }} onFile={setLastFile} />
          </div>
          <textarea
            ref={cvInputRef}
            value={cvText}
            onChange={(e) => { setCvText(e.target.value); setCopied(false); if (errorMsg) setErrorMsg(""); }}
            placeholder={mode === "letter" ? t("scanner.letterPlaceholder") : t("scanner.cvPlaceholder")}
            rows={10}
            style={{ width: "100%", resize: "vertical", fontSize: 13.5, lineHeight: 1.6, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }}
          />
          {errorMsg && <div style={{ color: "var(--err)", fontSize: 13.5, marginTop: 10 }}>{errorMsg}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn btn-p" onClick={() => analyze()} disabled={busy || perfecting || cvText.trim().length < 80}>
              {busy ? <><span className="spin" /> {t("scanner.analyzing")}</> : <>{t("scanner.analyze")}</>}
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
            <div ref={perfectedTextRef} className="card" style={{ marginTop: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>✨ {t("scanner.improvedTitle")}</div>
          <div
                onCopy={perfectedCopyLocked ? blockCopy : undefined}
                onCut={perfectedCopyLocked ? blockCopy : undefined}
                style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.7, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", userSelect: perfectedCopyLocked ? "none" : undefined, WebkitUserSelect: perfectedCopyLocked ? "none" : undefined }}
              >
              {perfectedText}
            </div>
            {!perfectedLocked && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button className="btn btn-g" onClick={copyPerfectedText}>
                  📋 {copied ? t("scanner.copied") : t("scanner.copyImproved")}
                </button>
                <button className="btn btn-g" onClick={usePerfectedText}>
                  ↩ {t("scanner.useImproved")}
                </button>
              </div>
            )}
            {perfectedLocked && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <div style={{ height: 42, marginTop: -54, position: "relative", background: "linear-gradient(to bottom, transparent, var(--card, #fff))", pointerEvents: "none" }} />
                <button className="btn btn-p" onClick={() => navigate("/pricing")}>
                  🔒 {t("preview.unlockPerfected")}
                </button>
                <p style={{ margin: "8px auto 0", maxWidth: 560, fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
                  {t("preview.unlockPerfectedHint")}
                </p>
              </div>
            )}
          </div>
        )}

        {perfectChanges && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>✅ {t("scanner.changesTitle")}</div>
            {perfectChanges.length > 0 && (
              <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                {perfectChanges.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            )}
          </div>
        )}

        {result && (
          <AnalysisCard
            result={result}
            onImprove={mode === "letter" ? runPerfect : undefined}
            improving={perfecting}
          />
        )}
      </div>
    </Layout>
  );
}
