import { useRef, useState, useEffect } from "react";
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
import { clearPreviewDraftField, readPreviewDraft, writePreviewDraft } from "../lib/previewDraft";

const MIN_AI_TEXT_LENGTH = 80;

/** Deko für die Bewerbung-Karte — gemeinsame Quelle mit CV-Vorlagen und Server-PDF. */
function letterDecoHtml(doc: any): string {
  return templateDeco(doc?.template, doc?.profile_data?.customStyle?.accent);
}

export default function Preview() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: doc, isLoading, error, refetch: refetchDocument } = useGetDocument(params.id ?? "");
  const { profile } = useAuth();
  const cvRef = useRef<HTMLDivElement>(null);
  const cvWrapRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"cv-pdf" | "letter-pdf" | "cv-docx" | "letter-docx" | null>(null);
  const [editedLetter, setEditedLetter] = useState("");
  const [editingCv, setEditingCv] = useState(false);
  const [saveError, setSaveError] = useState("");
  const cvManuallyEdited = useRef(false);
  const letterManuallyEdited = useRef(false);
  const editedLetterRef = useRef("");
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const cvSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const letterSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checking, setChecking] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [perfecting, setPerfecting] = useState(false);
  const [perfectChanges, setPerfectChanges] = useState<string[] | null>(null);
  // True once the letter shown is the AI-perfected version (this session)
  const [perfectedApplied, setPerfectedApplied] = useState(false);
  // True once the CV shown contains the AI-perfected profile (this session)
  const [cvPerfectedApplied, setCvPerfectedApplied] = useState(false);
  const [perfectedProfilePreview, setPerfectedProfilePreview] = useState<string | null>(null);
  const freeUser = !profile
    || (!(profile as any).is_premium
      && !(profile as any).is_unlimited
      && Number((profile as any).credits ?? 0) <= 0);
  const editLocked = freeUser;
  const visibleLetter = editedLetter;
  const hasCv = Boolean(
    doc && (
      (typeof (doc as any).cv_html === "string" && (doc as any).cv_html.trim()) ||
      (doc as any).cv_json
    ),
  );
  const hasLetter = Boolean(
    (typeof editedLetter === "string" && editedLetter.trim()) ||
    (doc && typeof (doc as any).cover_letter === "string" && (doc as any).cover_letter.trim()),
  );
  const currentLetterText = editedLetter || (doc && typeof (doc as any).cover_letter === "string" ? (doc as any).cover_letter : "");
  const checkUsesLetter = currentLetterText.trim().length >= MIN_AI_TEXT_LENGTH;
  const canPerfectLetter = currentLetterText.trim().length >= MIN_AI_TEXT_LENGTH;
  const [aiError, setAiError] = useState("");
  const [creatingLetter, setCreatingLetter] = useState(false);
  const [letterError, setLetterError] = useState(false);

  useEffect(() => {
    editedLetterRef.current = editedLetter;
  }, [editedLetter]);

  /**
   * Save only the preview portions that actually changed. Requests are queued
   * so a blur, "Fertig" click, and download in quick succession cannot let an
   * older PATCH overwrite a newer edit.
   */
  function savePreviewEdits({ cv = false, letter = false }: { cv?: boolean; letter?: boolean } = {}): Promise<boolean> {
    if (!params.id) return Promise.resolve(true);

    const cvHtml = cv && cvManuallyEdited.current ? cvRef.current?.innerHTML : undefined;
    const coverLetter = letter && letterManuallyEdited.current ? editedLetterRef.current : undefined;
    if (cvHtml === undefined && coverLetter === undefined) return saveQueueRef.current;

    const save = async () => {
      try {
        setSaveError("");
        await customFetch(`/api/documents/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...(cvHtml !== undefined ? { cv_html: cvHtml } : {}),
            ...(coverLetter !== undefined ? { cover_letter: coverLetter } : {}),
          }),
        });
        if (cvHtml !== undefined && cvRef.current?.innerHTML === cvHtml) {
          cvManuallyEdited.current = false;
          clearPreviewDraftField(params.id, "cvHtml", cvHtml);
        }
        if (coverLetter !== undefined && editedLetterRef.current === coverLetter) {
          letterManuallyEdited.current = false;
          clearPreviewDraftField(params.id, "coverLetter", coverLetter);
        }
        // Refresh the query cache for later navigation, while the current
        // editable DOM/state remains the source of truth on this screen.
        void refetchDocument();
        return true;
      } catch (error) {
        console.error("Preview edit save failed", error);
        setSaveError(t("scanner.error"));
        return false;
      }
    };

    const queuedSave = saveQueueRef.current.then(save, save);
    saveQueueRef.current = queuedSave;
    return queuedSave;
  }

  function clearCvSaveTimer() {
    if (cvSaveTimerRef.current !== null) {
      clearTimeout(cvSaveTimerRef.current);
      cvSaveTimerRef.current = null;
    }
  }

  function scheduleCvSave() {
    clearCvSaveTimer();
    cvSaveTimerRef.current = setTimeout(() => {
      cvSaveTimerRef.current = null;
      void savePreviewEdits({ cv: true });
    }, 500);
  }

  function clearLetterSaveTimer() {
    if (letterSaveTimerRef.current !== null) {
      clearTimeout(letterSaveTimerRef.current);
      letterSaveTimerRef.current = null;
    }
  }

  function scheduleLetterSave() {
    clearLetterSaveTimer();
    letterSaveTimerRef.current = setTimeout(() => {
      letterSaveTimerRef.current = null;
      void savePreviewEdits({ letter: true });
    }, 500);
  }

  async function leavePreview(destination = "/documents") {
    clearCvSaveTimer();
    clearLetterSaveTimer();
    if (!(await savePreviewEdits({ cv: true, letter: true }))) return;
    navigate(destination);
  }

  // Saving on input protects both editors from a refresh while they remain
  // open. The unmount cleanup also starts a final save for navigation from the
  // surrounding layout, where the Preview back button is not involved.
  useEffect(() => {
    const saveOnPageHide = () => {
      clearCvSaveTimer();
      clearLetterSaveTimer();
      if (cvManuallyEdited.current || letterManuallyEdited.current) {
        void savePreviewEdits({ cv: true, letter: true });
      }
    };
    window.addEventListener("pagehide", saveOnPageHide);
    return () => {
      window.removeEventListener("pagehide", saveOnPageHide);
      clearCvSaveTimer();
      clearLetterSaveTimer();
      if (cvManuallyEdited.current || letterManuallyEdited.current) {
        void savePreviewEdits({ cv: true, letter: true });
      }
    };
  }, [params.id]);

  async function handleCreateLetter() {
    setCreatingLetter(true);
    setLetterError(false);
    try {
      const resp = await customFetch<{ result: string }>(`/api/documents/${params.id}/cover-letter`, {
        method: "POST",
        body: JSON.stringify({ confirmFromCv: true }),
      });
      if (resp?.result) {
        editedLetterRef.current = resp.result;
        setEditedLetter(resp.result);
      }
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
    const isLetter = !!(letter && letter.trim().length >= MIN_AI_TEXT_LENGTH);
    const mainText = isLetter ? letter : cvText;
    if (mainText.length < MIN_AI_TEXT_LENGTH) return;
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
      if (code === "daily_limit_reached") setAiError(t("scanner.dailyLimit"));
      else setAiError(t("scanner.error"));
    }
    finally { setChecking(false); }
  }

  async function runPerfect() {
    const { cvText, letterText, jobText } = docTexts();
    if (!letterText || letterText.trim().length < MIN_AI_TEXT_LENGTH) return;
    // CV profile statement: perfected together with the letter (same rules)
    const cvJson: any = (doc as any)?.cv_json || null;
    const profileText = cvJson?.profile && String(cvJson.profile).trim().length >= 40 ? String(cvJson.profile) : undefined;
    setAiError(""); setPerfecting(true); setPerfectChanges(null);
    try {
      const res: any = await customFetch("/api/perfect", {
        method: "POST",
        body: JSON.stringify({ cvText, letterText, jobText: jobText || undefined, profileText, documentId: params.id, language: i18n.resolvedLanguage || "de" }),
      });
      if (typeof res?.letter === "string") {
        setEditedLetter(res.letter);
        setPerfectedApplied(true);
        setPerfectedProfilePreview(null);
        setPerfectChanges(Array.isArray(res.changes) ? res.changes : []);
        // Show the improved letter right away
        setTimeout(() => letterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        // Apply the improved CV profile statement in the visible CV.
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
        customFetch(`/api/documents/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            cover_letter: res.letter,
            ...(cvHtmlToSave ? { cv_html: cvHtmlToSave, cv_json: { ...cvJson, profile: res.profile } } : {}),
          }),
        }).catch(() => {});
        setPerfecting(false);
        await runCheck(res.letter, true);
        return;
      }
    } catch (e: any) {
      setAiError(e?.data?.error === "daily_limit_reached" ? t("scanner.dailyLimit") : t("scanner.error"));
    }
    finally { setPerfecting(false); }
  }

  // Initialise the cover letter from the server-authoritative document state.
  useEffect(() => {
    const d: any = doc;
    if (!d) return;
    if (d.perfected_locked || typeof d.perfected_letter === "string") {
      const letter = typeof d.perfected_letter === "string" ? d.perfected_letter : "";
      editedLetterRef.current = letter;
      setEditedLetter(letter);
      setPerfectedApplied(true);
      setPerfectChanges(Array.isArray(d.perfected_changes) ? d.perfected_changes : []);
      setPerfectedProfilePreview(typeof d.perfected_profile === "string"
        ? d.perfected_profile
        : null);
    } else {
      const draftLetter = readPreviewDraft(params.id || "").coverLetter;
      if (draftLetter !== undefined) {
        editedLetterRef.current = draftLetter;
        setEditedLetter(draftLetter);
        letterManuallyEdited.current = true;
        setTimeout(() => void savePreviewEdits({ letter: true }), 0);
        return;
      }
      if (!d.cover_letter) return;
      editedLetterRef.current = d.cover_letter;
      setEditedLetter(d.cover_letter);
      letterManuallyEdited.current = false;
      setPerfectedProfilePreview(null);
      setPerfectChanges(null);
    }
  }, [
    (doc as any)?.id,
    (doc as any)?.perfected_letter,
    (doc as any)?.perfected_locked,
    (doc as any)?.perfected_changes,
  ]);

  // Set CV HTML via ref so contentEditable edits are preserved across re-renders
  useEffect(() => {
    const d: any = doc;
    if (!cvRef.current || !d) return;
    const draftCvHtml = readPreviewDraft(params.id || "").cvHtml;
    if (draftCvHtml !== undefined) {
      cvRef.current.innerHTML = draftCvHtml;
      cvManuallyEdited.current = true;
      setTimeout(() => void savePreviewEdits({ cv: true }), 0);
    } else if (d.perfected_cv_html) {
      cvRef.current.innerHTML = d.perfected_cv_html;
      setCvPerfectedApplied(true);
    } else if (d.cv_html) {
      cvRef.current.innerHTML = d.cv_html;
    } else {
      cvRef.current.innerHTML = "";
    }
    cvManuallyEdited.current = false;
  }, [(doc as any)?.id, (doc as any)?.perfected_cv_html]);

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
    if (editLocked) return;
    if (editingCv) {
      setEditingCv(false);
      clearCvSaveTimer();
      void savePreviewEdits({ cv: true });
      return;
    }
    setEditingCv(true);
    setTimeout(() => cvRef.current?.focus(), 50);
  }

  function baseFileName(suffix: string) {
    const name = (doc as any)?.name
      ? (doc as any).name.replace(/[^a-zA-Z0-9\-_äöüÄÖÜß ]/g, "")
      : "";
    return `${name ? name + " – " : ""}${suffix}`;
  }

  async function printCv() {
    if (!(await savePreviewEdits({ cv: true }))) return;
    let el: HTMLElement | null = cvRef.current;
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
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(n => n.outerHTML)
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${styles}<style>body{margin:0;background:#fff}.cv-sheet{zoom:1 !important;box-shadow:none !important;margin:0 auto}</style></head><body>${clone.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  }

  async function printLetter() {
    if (!(await savePreviewEdits({ letter: true }))) return;
    const text = editedLetter || (doc as any)?.cover_letter || "";
    if (!text) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.7;margin:2.5cm;white-space:pre-wrap}</style></head><body></body></html>`);
    w.document.body.textContent = text;
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  // CV PDF: client-side via html2canvas so contentEditable edits are captured
  async function handleDownloadCvPdf() {
    if (!cvRef.current) return;
    if (!(await savePreviewEdits({ cv: true }))) return;
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
      pdf.save(baseFileName(t("preview.cvFileName")) + ".pdf");
    } catch (e) { console.error("CV PDF export failed", e); }
    finally { setExporting(null); }
  }

  // Cover letter PDF: server-side so edited text is forwarded correctly
  async function handleDownloadLetterPdf() {
    if (!(await savePreviewEdits({ letter: true }))) return;
    setExporting("letter-pdf");
    try {
      const blob = await customFetch<Blob>(`/api/documents/${params.id}/download/cover-letter.pdf`, { responseType: "blob" });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = baseFileName(t("preview.coverLetterFileName")) + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) { console.error("Letter PDF download failed", e); }
    finally { setExporting(null); }
  }

  async function downloadDocx(type: "cv" | "cover-letter") {
    if (!(await savePreviewEdits({ cv: type === "cv", letter: type === "cover-letter" }))) return;
    const key = type === "cv" ? "cv-docx" : "letter-docx";
    setExporting(key as any);
    try {
      const blob = await customFetch<Blob>(`/api/documents/${params.id}/download/${type}.docx`, { responseType: "blob" });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = baseFileName(t(type === "cv" ? "preview.cvFileName" : "preview.coverLetterFileName")) + ".docx";
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
          <button className="btn btn-g" onClick={() => { void leavePreview(); }}>{t("preview.back")}</button>
          {doc && (doc as any).cv_json && (
            <button className="btn btn-p btn-sm" onClick={() => void leavePreview(`/documents/${params.id}/edit`)}>
              ✏️ {t("editor.editInEditor")}
            </button>
          )}
          {doc && (
            <>
              <h2 style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, flex: 1, minWidth: 0 }}>
                {(doc as any).name}
              </h2>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                 {hasCv && (
                   <button className="btn btn-p btn-sm" onClick={printCv}>
                     {t("preview.print")} · {t("preview.cv")}
                   </button>
                 )}
                 {hasLetter && (
                   <button className="btn btn-p btn-sm" onClick={printLetter}>
                     {t("preview.print")} · {t("preview.coverLetter")}
                   </button>
                 )}
                {hasCv && (
                  <>
                  <button className="btn btn-p btn-sm" onClick={handleDownloadCvPdf} disabled={exporting !== null} style={{ minWidth: 140 }}>
                    {exporting === "cv-pdf" ? <><span className="spin" /> {t("preview.creatingPdf")}</> : <>{t("preview.downloadCv")}</>}
                   </button>
                   <button className="btn btn-g btn-sm" onClick={() => downloadDocx("cv")} disabled={exporting !== null} title={t("preview.downloadDocxTooltip")} style={{ minWidth: 120 }}>
                      {exporting === "cv-docx" ? <><span className="spin" /> {t("preview.creatingDocx")}</> : <>{t("preview.downloadCvDocx")}</>}
                   </button>
                  </>
                )}
                 {hasLetter && (
                  <>
                    <button className="btn btn-p btn-sm" onClick={handleDownloadLetterPdf} disabled={exporting !== null} style={{ minWidth: 140 }}>
                      {exporting === "letter-pdf" ? <><span className="spin" /> {t("preview.creatingPdf")}</> : <>{t("preview.downloadLetter")}</>}
                    </button>
                    <button className="btn btn-g btn-sm" onClick={() => downloadDocx("cover-letter")} disabled={exporting !== null} title={t("preview.downloadDocxTooltip")} style={{ minWidth: 140 }}>
                      {exporting === "letter-docx" ? <><span className="spin" /> {t("preview.creatingDocx")}</> : <>{t("preview.downloadLetterDocx")}</>}
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
        {saveError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 12, color: "var(--err)", marginBottom: 16 }}>
            {saveError}
          </div>
        )}

        {doc && hasCv && (doc as any).profile_data?.atsScore?.score != null && (() => {
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

        {doc && (hasCv || hasLetter) && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-p btn-sm" onClick={() => runCheck()} disabled={checking || perfecting}>
                {checking ? <><span className="spin" /> {t("preview.checking")}</> : <>🔎 {t(checkUsesLetter ? "preview.checkLetterBtn" : "preview.checkCvBtn")}</>}
              </button>
              {hasLetter && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    className="btn btn-g btn-sm"
                    onClick={runPerfect}
                    disabled={checking || perfecting || !canPerfectLetter}
                  >
                    {perfecting ? <><span className="spin" /> {t("preview.perfecting")}</> : <>✨ {t("preview.perfectBtn")}</>}
                  </button>
                  {!canPerfectLetter && (
                    <span style={{ fontSize: 11.5, color: "var(--muted)", maxWidth: 190 }}>
                      {t("preview.perfectMinLength")}
                    </span>
                  )}
                </div>
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
            {perfectedProfilePreview && (
              <div style={{ marginTop: 12, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 5 }}>
                  ✨ {t("preview.profilePreview")}
                </div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--text2)",
                  }}
                >
                  {perfectedProfilePreview}
                </div>
              </div>
            )}
            {analysis && <AnalysisCard result={analysis} />}
          </div>
        )}

        {doc && (
          <>
            {hasCv && <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700 }}>{t("preview.cv")}</h3>
                <button
                  className={editingCv ? "btn btn-p btn-sm" : "btn btn-g btn-sm"}
                  onClick={toggleEditCv}
                  disabled={editLocked}
                >
                  {editingCv ? t("preview.doneEditing") : t("preview.editCvBtn")}
                </button>
              </div>
              {false ? (
                <div className="cv-wrap">
                  <div className="cv-sheet" style={{ padding: "32px 28px", minHeight: 280, position: "relative", overflow: "hidden" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", marginBottom: 10 }}>
                      🔒 {t("preview.previewOnly")}
                    </div>
                    {(doc as any)?.perfected_cv_html ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: (doc as any).perfected_cv_html,
                        }}
                        style={{ fontSize: 13.5, lineHeight: 1.65, userSelect: "none", WebkitUserSelect: "none" }}
                      />
                    ) : perfectedProfilePreview ? (
                      <>
                        <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                          {t("preview.profilePreview")}
                        </div>
                        <div
                          style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.65, userSelect: "none", WebkitUserSelect: "none" }}
                        >
                          {perfectedProfilePreview}
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                        {t("preview.unlockPerfectedHint")}
                      </p>
                    )}
                    <div style={{ height: 42, margin: "0 -28px -32px", background: "linear-gradient(to bottom, transparent, #fff)" }} />
                    <div style={{ textAlign: "center", marginTop: 10 }}>
                      <button className="btn btn-p" onClick={toggleEditCv}>
                        {t("preview.editCvBtn")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cv-wrap" ref={cvWrapRef}>
                  <div
                    ref={cvRef}
                    className="cv-sheet"
                    contentEditable={editingCv && !editLocked}
                    suppressContentEditableWarning
                    onInput={() => {
                      if (!editingCv) return;
                      cvManuallyEdited.current = true;
                      if (params.id && cvRef.current) {
                        writePreviewDraft(params.id, { cvHtml: cvRef.current.innerHTML });
                      }
                      scheduleCvSave();
                    }}
                    onBlur={() => {
                      if (!editingCv) return;
                      clearCvSaveTimer();
                      void savePreviewEdits({ cv: true });
                    }}
                    onPaste={e => {
                      if (!editingCv) return;
                      e.preventDefault();
                      document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
                    }}
                    onDrop={e => {
                      if (editingCv) e.preventDefault();
                    }}
                    style={{
                      outline: editingCv ? "2px solid var(--acc, #2563eb)" : "none",
                    }}
                  />
                </div>
              )}
            </div>}

            {hasCv && !hasLetter && (
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

            {hasLetter && (
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
                    value={visibleLetter}
                     disabled={editLocked}
                    onChange={e => {
                      editedLetterRef.current = e.target.value;
                      setEditedLetter(e.target.value);
                      letterManuallyEdited.current = true;
                      if (params.id) writePreviewDraft(params.id, { coverLetter: e.target.value });
                      scheduleLetterSave();
                    }}
                    onBlur={() => {
                      clearLetterSaveTimer();
                      void savePreviewEdits({ letter: true });
                    }}
                   onCopy={freeUser ? e => e.preventDefault() : undefined}
                   onCut={freeUser ? e => e.preventDefault() : undefined}
                   onContextMenu={freeUser ? e => e.preventDefault() : undefined}
                    style={{
                      whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8, color: "var(--text2)",
                      width: "100%", border: "none", outline: "none", resize: "vertical",
                      minHeight: 320, padding: "1.25rem", fontFamily: "inherit",
                      background: "transparent", display: "block", boxSizing: "border-box",
                      position: "relative", zIndex: 1,
                       userSelect: editLocked ? "none" : "text",
                       WebkitUserSelect: editLocked ? "none" : "text",
                       ...(editLocked ? { cursor: "not-allowed", opacity: 0.78 } : {}),
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
