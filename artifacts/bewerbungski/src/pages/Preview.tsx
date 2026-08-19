import { useRef, useState, useEffect, type ClipboardEvent } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useGetDocument } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { templateDeco } from "@workspace/template-deco";
import { useAuth } from "../context/AuthContext";
import { AnalysisCard } from "./Scanner";

/** Deko für die Bewerbung-Karte — gemeinsame Quelle mit CV-Vorlagen und Server-PDF. */
function letterDecoHtml(doc: any): string {
  return templateDeco(doc?.template, doc?.profile_data?.customStyle?.accent);
}

export default function Preview() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: doc, isLoading, error } = useGetDocument(params.id ?? "");
  const cvRef = useRef<HTMLDivElement>(null);
  const cvWrapRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"cv-pdf" | "letter-pdf" | "cv-docx" | "letter-docx" | null>(null);
  const [editedLetter, setEditedLetter] = useState("");
  const [editingCv, setEditingCv] = useState(false);
  const [checking, setChecking] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [perfecting, setPerfecting] = useState(false);
  const [perfectChanges, setPerfectChanges] = useState<string[] | null>(null);
  // True once the letter shown is the AI-perfected version (this session)
  const [perfectedApplied, setPerfectedApplied] = useState(false);
  // True once the CV shown contains the AI-perfected profile (this session)
  const [cvPerfectedApplied, setCvPerfectedApplied] = useState(false);
  const { profile } = useAuth();
  const pAuth = profile as any;
  const freeUser = !!pAuth && !pAuth.is_premium && (pAuth.credits || 0) === 0;
  // Free accounts may try everything on screen, but download and print are
  // paid-only (policy 2026-08-19). Server enforces the same rules.
  const docxLocked = freeUser;
  const editLocked = false; // everything is open except download & print
  const [printUsed, setPrintUsed] = useState<Record<string, number>>({});
  void printUsed;
  const cvPrintLocked = freeUser;
  const letterPrintLocked = freeUser;
  const pdfLocked = freeUser;
  const letterCopyLocked = freeUser && perfectedApplied;
  const cvCopyLocked = freeUser && cvPerfectedApplied;
  const [aiError, setAiError] = useState("");
  const [creatingLetter, setCreatingLetter] = useState(false);
  const [letterError, setLetterError] = useState(false);

  function blockCopy(e: ClipboardEvent<HTMLElement>) {
    e.preventDefault();
  }

  async function handleCreateLetter() {
    setCreatingLetter(true);
    setLetterError(false);
    try {
      const resp = await customFetch<{ result: string }>(`/api/documents/${params.id}/cover-letter`, { method: "POST" });
      if (resp?.result) setEditedLetter(resp.result);
      else setLetterError(true);
    } catch (e) {
      console.error("Cover letter generation failed", e);
      setLetterError(true);
    } finally {
      setCreatingLetter(false);
    }
  }

  function docTexts() {
    const d: any = doc || {};
    const cvText = String(d.cv_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const pd = d.profile_data || {};
    const jobText = [pd.jobad?.title, pd.jobad?.company, pd.jobad?.description].filter(Boolean).join("\n");
    return { cvText, letterText: editedLetter || d.cover_letter || "", jobText };
  }

  const { i18n } = useTranslation();
  async function runCheck(letterOverride?: string, keepChanges?: boolean) {
    const { cvText, letterText, jobText } = docTexts();
    const letter = letterOverride ?? letterText;
    // If a Bewerbung exists, check ONLY the Bewerbung (never drag the CV in); otherwise check the CV.
    const isLetter = !!(letter && letter.trim().length >= 80);
    const mainText = isLetter ? letter : cvText;
    if (mainText.length < 80) return;
    setAiError(""); setChecking(true); setAnalysis(null);
    if (!keepChanges) setPerfectChanges(null);
    try {
      const res = await customFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ cvText: mainText, docType: isLetter ? "letter" : "cv", jobText: jobText || undefined, contextText: isLetter && cvText.length >= 80 ? cvText : undefined, language: i18n.resolvedLanguage || "de" }),
      });
      setAnalysis(res);
    } catch (e: any) {
      const code = e?.data?.error;
      if (code === "upgrade_required") { navigate("/pricing"); }
      else if (code === "daily_limit_reached") setAiError(t("scanner.dailyLimit"));
      else setAiError(t("scanner.error"));
    }
    finally { setChecking(false); }
  }

  async function runPerfect() {
    const { cvText, letterText, jobText } = docTexts();
    if (!letterText || letterText.trim().length < 80) return;
    // CV profile statement: perfected together with the letter (same rules)
    const cvJson: any = (doc as any)?.cv_json || null;
    const profileText = cvJson?.profile && String(cvJson.profile).trim().length >= 40 ? String(cvJson.profile) : undefined;
    setAiError(""); setPerfecting(true); setPerfectChanges(null);
    try {
      const res: any = await customFetch("/api/perfect", {
        method: "POST",
        body: JSON.stringify({ cvText, letterText, jobText: jobText || undefined, profileText, language: i18n.resolvedLanguage || "de" }),
      });
      if (res?.letter) {
        setEditedLetter(res.letter);
        setPerfectedApplied(true);
        setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
        // Show the improved letter right away
        setTimeout(() => letterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        // Apply the improved CV profile statement in the visible CV (view is
        // free; downloads of the perfected CV stay behind the purchase)
        let cvHtmlToSave: string | undefined;
        if (typeof res.profile === "string" && res.profile.trim().length >= 40 && profileText && cvRef.current) {
          const target = Array.from(cvRef.current.querySelectorAll("p,div")).find(
            (el) => el.children.length === 0 && (el.textContent || "").trim() === profileText.trim(),
          );
          if (target) {
            target.textContent = res.profile;
            setCvPerfectedApplied(true);
            cvHtmlToSave = cvRef.current.innerHTML;
          }
        }
        // Save + compute the new score in the background. Free accounts save
        // into the view-only perfected fields (visible after reload, never
        // used by downloads); buyers save into the real document.
        customFetch(`/api/documents/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify(
            freeUser || !pAuth
              ? {
                  perfected_letter: res.letter,
                  ...(cvHtmlToSave ? { perfected_cv_html: cvHtmlToSave } : {}),
                }
              : {
                  cover_letter: res.letter,
                  ...(cvHtmlToSave ? { cv_html: cvHtmlToSave, cv_json: { ...cvJson, profile: res.profile } } : {}),
                },
          ),
        }).catch(() => {});
        setPerfecting(false);
        await runCheck(res.letter, true);
        return;
      }
    } catch (e: any) {
      setAiError(e?.data?.error === "daily_limit_reached" ? t("scanner.dailyLimit") : e?.data?.error === "perfect_limit_reached" ? t("scanner.perfectLimit") : t("scanner.error"));
    }
    finally { setPerfecting(false); }
  }

  // Load already-used prints so the lock survives a reload
  useEffect(() => {
    if (!freeUser || !params.id) return;
    customFetch(`/api/documents/${params.id}/export-counters`)
      .then((r: any) => { if (r?.counts) setPrintUsed(r.counts); })
      .catch(() => {});
  }, [params.id, freeUser]);

  // Initialise cover letter textarea from loaded doc. A stored perfected copy
  // is shown to free users (view-only — downloads keep serving the original).
  useEffect(() => {
    const d: any = doc;
    if (!d) return;
    if (freeUser && d.perfected_letter) {
      setEditedLetter(d.perfected_letter);
      setPerfectedApplied(true);
    } else if (d.cover_letter) {
      setEditedLetter(d.cover_letter);
    }
  }, [(doc as any)?.id, freeUser]);

  // Set CV HTML via ref so contentEditable edits are preserved across re-renders
  useEffect(() => {
    const d: any = doc;
    if (!cvRef.current || !d) return;
    if (freeUser && d.perfected_cv_html) {
      cvRef.current.innerHTML = d.perfected_cv_html;
      setCvPerfectedApplied(true);
    } else if (d.cv_html) {
      cvRef.current.innerHTML = d.cv_html;
    }
  }, [(doc as any)?.id, freeUser]);

  // Buyers: promote a perfected copy saved while the account was still free
  // into the real document (they paid — downloads should include it).
  useEffect(() => {
    const d: any = doc;
    if (!d || !pAuth || freeUser) return;
    if (!d.perfected_letter && !d.perfected_cv_html) return;
    customFetch(`/api/documents/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(d.perfected_letter ? { cover_letter: d.perfected_letter } : {}),
        ...(d.perfected_cv_html ? { cv_html: d.perfected_cv_html } : {}),
        perfected_letter: null,
        perfected_cv_html: null,
      }),
    }).then(() => {
      if (d.perfected_letter) setEditedLetter(d.perfected_letter);
      if (d.perfected_cv_html && cvRef.current) cvRef.current.innerHTML = d.perfected_cv_html;
    }).catch(() => {});
  }, [(doc as any)?.id, freeUser, !!pAuth, (doc as any)?.perfected_letter, (doc as any)?.perfected_cv_html]);

  // Scale cv-sheet to fit narrow mobile viewports using zoom (preserves touch targets).
  // While editing, show at 100% with horizontal scroll — mobile browsers misplace the
  // text caret inside zoomed contentEditable areas.
  useEffect(() => {
    function applyScale() {
      if (!cvWrapRef.current || !cvRef.current) return;
      if (editingCv) {
        cvRef.current.style.zoom = "1";
        cvWrapRef.current.style.minHeight = "";
        return;
      }
      const available = cvWrapRef.current.clientWidth - 24;
      const cvWidth = 760;
      const scale = available < cvWidth ? available / cvWidth : 1;
      cvRef.current.style.zoom = String(scale);
      cvWrapRef.current.style.minHeight = scale < 1
        ? `${cvRef.current.offsetHeight * scale + 24}px`
        : "";
    }
    applyScale();
    window.addEventListener("resize", applyScale);
    return () => window.removeEventListener("resize", applyScale);
  }, [(doc as any)?.id, editingCv]);

  function toggleEditCv() {
    setEditingCv(prev => {
      const next = !prev;
      if (next) setTimeout(() => cvRef.current?.focus(), 50);
      return next;
    });
  }

  function baseFileName(suffix: string) {
    const name = (doc as any)?.name
      ? (doc as any).name.replace(/[^a-zA-Z0-9\-_äöüÄÖÜß ]/g, "")
      : "";
    return `${name ? name + " – " : ""}${suffix}`;
  }

  // Free accounts: one print per part — the popup is opened synchronously
  // (click context), then the server confirms the remaining allowance.
  async function consumePrint(kind: "cv_print" | "letter_print"): Promise<boolean> {
    if (!freeUser) return true;
    try {
      const r: any = await customFetch(`/api/documents/${params.id}/export-event`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      if (r?.allowed) {
        setPrintUsed((u) => ({ ...u, [kind]: (u[kind] || 0) + 1 }));
        return true;
      }
    } catch { /* fall through: treat as not allowed */ }
    setPrintUsed((u) => ({ ...u, [kind]: 1 }));
    return false;
  }

  async function printCv() {
    let el: HTMLElement | null = cvRef.current;
    // Free accounts: the screen may show the perfected version, but prints
    // always use the stored ORIGINAL (perfected output is paid-only).
    if (freeUser && (doc as any)?.cv_html) {
      const tmp = document.createElement("div");
      tmp.innerHTML = (doc as any).cv_html;
      el = tmp;
    }
    if (!el) return;
    // Sanitize the stored CV HTML before re-parsing it in the popup:
    // remove active content and event handlers (document.write would execute them).
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script,iframe,object,embed,form,link,meta").forEach(n => n.remove());
    clone.querySelectorAll("*").forEach(n => {
      for (const a of Array.from((n as Element).attributes)) {
        if (/^on/i.test(a.name) || (/^(href|src|xlink:href)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) {
          (n as Element).removeAttribute(a.name);
        }
      }
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.opener = null;
    if (!(await consumePrint("cv_print"))) { w.close(); navigate("/pricing"); return; }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(n => n.outerHTML)
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${styles}<style>body{margin:0;background:#fff}.cv-sheet{zoom:1 !important;box-shadow:none !important;margin:0 auto}</style></head><body>${clone.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  }

  async function printLetter() {
    // Free accounts always print the stored ORIGINAL letter — the perfected
    // version shown on screen is paid-only.
    const text = freeUser
      ? ((doc as any)?.cover_letter || "")
      : (editedLetter || (doc as any)?.cover_letter || "");
    if (!text) return;
    const w = window.open("", "_blank");
    if (!w) return;
    if (!(await consumePrint("letter_print"))) { w.close(); navigate("/pricing"); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.7;margin:2.5cm;white-space:pre-wrap}</style></head><body></body></html>`);
    w.document.body.textContent = text;
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  // CV PDF: client-side via html2canvas so contentEditable edits are captured
  async function handleDownloadCvPdf() {
    // Downloads are paid-only for free accounts
    if (pdfLocked) { navigate("/pricing"); return; }
    if (!cvRef.current) return;
    setExporting("cv-pdf");
    try {
      const el = cvRef.current;
      // On mobile the preview is scaled down via CSS zoom — reset it during
      // capture, otherwise html2canvas rasterises the shrunken element and the
      // text comes out blurry/jagged in the PDF.
      const prevZoom = el.style.zoom;
      el.style.zoom = "1";
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: "#ffffff", logging: false, windowWidth: 794 });
      } finally {
        el.style.zoom = prevZoom;
      }
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let yOffset = 0;
      pdf.addImage(imgData, "PNG", 0, yOffset, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        yOffset -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, yOffset, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(baseFileName("Lebenslauf") + ".pdf");
    } catch (e) { console.error("CV PDF export failed", e); }
    finally { setExporting(null); }
  }

  // Cover letter PDF: server-side so edited text is forwarded correctly
  async function handleDownloadLetterPdf() {
    // Downloads are paid-only for free accounts
    if (pdfLocked) { navigate("/pricing"); return; }
    setExporting("letter-pdf");
    try {
      let url = `/api/documents/${params.id}/download/cover-letter.pdf`;
      if (editedLetter) url += "?text=" + encodeURIComponent(editedLetter);
      const blob = await customFetch<Blob>(url, { responseType: "blob" });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = baseFileName("Bewerbung") + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) { console.error("Letter PDF download failed", e); }
    finally { setExporting(null); }
  }

  async function downloadDocx(type: "cv" | "cover-letter") {
    if (docxLocked) { navigate("/pricing"); return; }
    const key = type === "cv" ? "cv-docx" : "letter-docx";
    setExporting(key as any);
    try {
      let url = `/api/documents/${params.id}/download/${type}.docx`;
      if (type === "cover-letter" && editedLetter) {
        url += "?text=" + encodeURIComponent(editedLetter);
      }
      const blob = await customFetch<Blob>(url, { responseType: "blob" });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = baseFileName(type === "cv" ? "Lebenslauf" : "Bewerbung") + ".docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) { console.error("DOCX download failed", e); }
    finally { setExporting(null); }
  }

  return (
    <Layout>
      <div className="fade">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <button className="btn btn-g" onClick={() => navigate("/documents")}>{t("preview.back")}</button>
          {doc && (doc as any).cv_json && (
            <button className="btn btn-p btn-sm" onClick={() => (editLocked ? navigate("/pricing") : navigate(`/documents/${params.id}/edit`))} style={editLocked ? { opacity: 0.6 } : undefined}>
              {editLocked ? "🔒" : "✏️"} {t("editor.editInEditor") || "Live-Editor"}
            </button>
          )}
          {doc && (
            <>
              <h2 style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, flex: 1, minWidth: 0 }}>
                {(doc as any).name}
              </h2>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                {freeUser && (
                  <>
                    <button className="btn btn-p btn-sm" onClick={() => (cvPrintLocked ? navigate("/pricing") : printCv())} style={cvPrintLocked ? { opacity: 0.6 } : undefined}>
                      {cvPrintLocked ? "🔒 " : ""}{t("preview.print")} · {t("preview.cv")}
                    </button>
                    {((doc as any)?.cover_letter || editedLetter) && (
                      <button className="btn btn-p btn-sm" onClick={() => (letterPrintLocked ? navigate("/pricing") : printLetter())} style={letterPrintLocked ? { opacity: 0.6 } : undefined}>
                        {letterPrintLocked ? "🔒 " : ""}{t("preview.print")} · {t("preview.coverLetter")}
                      </button>
                    )}
                  </>
                )}
                <button className="btn btn-p btn-sm" onClick={handleDownloadCvPdf} disabled={exporting !== null} style={{ minWidth: 140 }}>
                  {exporting === "cv-pdf" ? <><span className="spin" /> {t("preview.creatingPdf")}</> : <>{t("preview.downloadCv")}</>}
                </button>
                <button className="btn btn-g btn-sm" onClick={() => downloadDocx("cv")} disabled={exporting !== null} title="Als Word-Datei (.docx) herunterladen" style={{ minWidth: 120 }}>
                  {exporting === "cv-docx" ? <><span className="spin" /> Word…</> : <>{docxLocked ? "🔒" : "⬇"} CV .docx</>}
                </button>
                {((doc as any)?.cover_letter || editedLetter) && (
                  <>
                    <button className="btn btn-p btn-sm" onClick={handleDownloadLetterPdf} disabled={exporting !== null} style={{ minWidth: 140 }}>
                      {exporting === "letter-pdf" ? <><span className="spin" /> {t("preview.creatingPdf")}</> : <>{t("preview.downloadLetter")}</>}
                    </button>
                    <button className="btn btn-g btn-sm" onClick={() => downloadDocx("cover-letter")} disabled={exporting !== null} title="Als Word-Datei (.docx) herunterladen" style={{ minWidth: 140 }}>
                      {exporting === "letter-docx" ? <><span className="spin" /> Word…</> : <>{docxLocked ? "🔒" : "⬇"} Bewerbung .docx</>}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {isLoading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
            <span className="spin" /> {t("preview.loading")}
          </div>
        )}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 20, color: "var(--err)" }}>
            {t("preview.loadError")}
          </div>
        )}

        {doc && (doc as any).profile_data?.atsScore?.score != null && (() => {
          const ats = (doc as any).profile_data.atsScore;
          const col = ats.score >= 70 ? "#059669" : ats.score >= 45 ? "#d97706" : "#dc2626";
          return (
            <div className="card" style={{ marginBottom: 24, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", border: `5px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 19, color: col, flexShrink: 0 }}>
                {ats.score}%
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🎯 {t("preview.ats.title")}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
                  {ats.keywordScore != null && (<>{t("preview.ats.keywords")}: <b style={{ color: "var(--text2)" }}>{ats.keywordScore}%</b> · </>)}{t("preview.ats.structure")}: <b style={{ color: "var(--text2)" }}>{ats.sectionScore}%</b>
                  {ats.missing?.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {t("preview.ats.missing")}: {ats.missing.map((m: string) => (
                        <span key={m} style={{ display: "inline-block", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "1px 9px", margin: "2px 4px 0 0", fontSize: 12 }}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {doc && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-p btn-sm" onClick={() => runCheck()} disabled={checking || perfecting}>
                {checking ? <><span className="spin" /> {t("preview.checking")}</> : <>🔎 {t("preview.checkBtn")}</>}
              </button>
              {((doc as any)?.cover_letter || editedLetter) && (
                <button className="btn btn-g btn-sm" onClick={runPerfect} disabled={checking || perfecting}>
                  {perfecting ? <><span className="spin" /> {t("preview.perfecting")}</> : <>✨ {t("preview.perfectBtn")}</>}
                </button>
              )}
            </div>
            {aiError && <div style={{ color: "var(--err)", fontSize: 13.5, marginTop: 10 }}>{aiError}</div>}
            {perfectChanges && (
              <div style={{ marginTop: 12, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>✅ {t("preview.perfectDone")}</div>
                {perfectChanges.length > 0 && (
                  <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                    {perfectChanges.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
              </div>
            )}
            {analysis && <AnalysisCard result={analysis} />}
          </div>
        )}

        {doc && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700 }}>{t("preview.cv")}</h3>
                <button
                  className={editingCv ? "btn btn-p btn-sm" : "btn btn-g btn-sm"}
                  onClick={() => (editLocked ? navigate("/pricing") : toggleEditCv())}
                  style={editLocked ? { opacity: 0.6 } : undefined}
                >
                  {editLocked ? "🔒 " : ""}{editingCv ? t("preview.doneEditing") : t("preview.editCvBtn")}
                </button>
              </div>
              <div className="cv-wrap" ref={cvWrapRef}>
                <div
                  ref={cvRef}
                  className="cv-sheet"
                  contentEditable={editingCv}
                  suppressContentEditableWarning
                  onCopy={cvCopyLocked ? blockCopy : undefined}
                  onCut={cvCopyLocked ? blockCopy : undefined}
                  onContextMenu={cvCopyLocked ? e => e.preventDefault() : undefined}
                  style={{
                    outline: editingCv ? "2px solid var(--acc, #2563eb)" : "none",
                    userSelect: cvCopyLocked ? "none" : undefined,
                    WebkitUserSelect: cvCopyLocked ? "none" : undefined,
                  }}
                />
              </div>
            </div>

            {!((doc as any)?.cover_letter || editedLetter) && (
              <div className="card" style={{ border: "1px dashed var(--border)", borderRadius: 14, padding: 24, textAlign: "center" }}>
                <div style={{ fontFamily: "var(--fd)", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
                  ✉️ {t("preview.noLetterTitle")}
                </div>
                <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>
                  {t("preview.noLetterText")}
                </div>
                <button className="btn btn-p" onClick={handleCreateLetter} disabled={creatingLetter}>
                  {creatingLetter ? <><span className="spin" /> {t("preview.creatingLetter")}</> : <>{t("preview.createLetterNow")}</>}
                </button>
                {letterError && (
                  <div style={{ marginTop: 12, fontSize: 13, color: "var(--err)" }}>{t("preview.letterCreateError")}</div>
                )}
              </div>
            )}

            {((doc as any)?.cover_letter || editedLetter) && (
              <div ref={letterRef}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700 }}>{t("preview.coverLetter")}</h3>
                  <span style={{ fontSize: 12, color: "var(--muted)", background: "var(--bg2)", padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)" }}>
                    {t("preview.editLetterHint")}
                  </span>
                </div>
                <div
                  className="card"
                  style={{
                    position: "relative", zIndex: 0, overflow: "hidden",
                    borderRadius: 14, border: "1px solid var(--border)",
                    background: "#fff", padding: 0,
                  }}
                >
                  {/* Deko-Layer passend zur gewählten CV-Vorlage (statische, sichere Konstanten) */}
                  <div
                    aria-hidden
                    dangerouslySetInnerHTML={{ __html: letterDecoHtml(doc) }}
                  />
                  <textarea
                    value={editedLetter}
                    readOnly={editLocked}
                    onChange={e => { if (!editLocked) setEditedLetter(e.target.value); }}
                    onCopy={letterCopyLocked ? blockCopy : undefined}
                    onCut={letterCopyLocked ? blockCopy : undefined}
                    onContextMenu={letterCopyLocked ? e => e.preventDefault() : undefined}
                    style={{
                      whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8, color: "var(--text2)",
                      width: "100%", border: "none", outline: "none", resize: "vertical",
                      minHeight: 320, padding: "1.25rem", fontFamily: "inherit",
                      background: "transparent", display: "block", boxSizing: "border-box",
                      position: "relative", zIndex: 1,
                      userSelect: letterCopyLocked ? "none" : undefined,
                      WebkitUserSelect: letterCopyLocked ? "none" : undefined,
                    }}
                  />
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </Layout>
  );
}
