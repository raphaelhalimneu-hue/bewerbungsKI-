import { useRef, useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useGetDocument } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Preview() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: doc, isLoading, error } = useGetDocument(params.id ?? "");
  const cvRef = useRef<HTMLDivElement>(null);
  const cvWrapRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"cv" | "letter" | "cv-docx" | "letter-docx" | null>(null);
  const [editedLetter, setEditedLetter] = useState("");

  // Initialise cover letter textarea from loaded doc
  useEffect(() => {
    if ((doc as any)?.cover_letter) setEditedLetter((doc as any).cover_letter);
  }, [(doc as any)?.id]);

  // Set CV HTML via ref so contentEditable edits are preserved across re-renders
  useEffect(() => {
    if (cvRef.current && (doc as any)?.cv_html) {
      cvRef.current.innerHTML = (doc as any).cv_html;
    }
  }, [(doc as any)?.id]);

  // Scale cv-sheet to fit narrow mobile viewports
  useEffect(() => {
    function applyScale() {
      if (!cvWrapRef.current) return;
      const available = cvWrapRef.current.clientWidth - 24; // minus padding
      const cvWidth = 760;
      const scale = available < cvWidth ? available / cvWidth : 1;
      cvWrapRef.current.style.setProperty("--cv-scale", String(scale));
      // also shrink the wrap height to match scaled content
      if (cvRef.current) {
        cvWrapRef.current.style.minHeight = scale < 1
          ? `${cvRef.current.offsetHeight * scale + 24}px`
          : "";
      }
    }
    applyScale();
    window.addEventListener("resize", applyScale);
    return () => window.removeEventListener("resize", applyScale);
  }, [(doc as any)?.id]);

  function baseFileName(suffix: string) {
    const name = (doc as any)?.name
      ? (doc as any).name.replace(/[^a-zA-Z0-9\-_äöüÄÖÜß ]/g, "")
      : "";
    return `${name ? name + " – " : ""}${suffix}`;
  }

  async function handleDownloadCv() {
    if (!cvRef.current) return;
    setExporting("cv");
    try {
      const el = cvRef.current;
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: "#ffffff", logging: false, windowWidth: 794 });
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
    } catch (e) { console.error("PDF export failed", e); }
    finally { setExporting(null); }
  }

  function handleDownloadLetter() {
    if (!editedLetter.trim()) return;
    setExporting("letter");
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const maxWidth = pageWidth - margin * 2;
      const lineHeight = 6.4;
      let y = margin;
      const applicantName = ((doc as any)?.name || "").split("–")[0].trim();
      if (applicantName) {
        pdf.setTextColor(31, 41, 55); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15);
        pdf.text(applicantName.toUpperCase(), pageWidth / 2, y, { align: "center", charSpace: 0.8 });
        y += 4;
        pdf.setDrawColor(31, 41, 55); pdf.setLineWidth(0.4);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 12;
      }
      pdf.setTextColor(31, 41, 55); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      for (const para of editedLetter.split(/\n/)) {
        const lines: string[] = para.trim() === "" ? [""] : pdf.splitTextToSize(para, maxWidth);
        for (const line of lines) {
          if (y > pageHeight - margin) { pdf.addPage(); y = margin; }
          if (line !== "") pdf.text(line, margin, y);
          y += lineHeight;
        }
      }
      pdf.save(baseFileName("Anschreiben") + ".pdf");
    } catch (e) { console.error("PDF export failed", e); }
    finally { setExporting(null); }
  }

  async function downloadDocx(type: "cv" | "cover-letter") {
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
      a.download = baseFileName(type === "cv" ? "Lebenslauf" : "Anschreiben") + ".docx";
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
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <button className="btn btn-g" onClick={() => navigate("/documents")}>{t("preview.back")}</button>
          {doc && (
            <>
              <h2 style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, flex: 1, minWidth: 0 }}>
                {(doc as any).name}
              </h2>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                {/* CV downloads */}
                <button className="btn btn-p btn-sm" onClick={handleDownloadCv} disabled={exporting !== null} style={{ minWidth: 140 }}>
                  {exporting === "cv" ? <><span className="spin" /> {t("preview.creatingPdf")}</> : <>{t("preview.downloadCv")}</>}
                </button>
                <button className="btn btn-g btn-sm" onClick={() => downloadDocx("cv")} disabled={exporting !== null} title="Als Word-Datei (.docx) herunterladen" style={{ minWidth: 120 }}>
                  {exporting === "cv-docx" ? <><span className="spin" /> Word…</> : <>⬇ CV .docx</>}
                </button>
                {/* Letter downloads */}
                {((doc as any)?.cover_letter || editedLetter) && (
                  <>
                    <button className="btn btn-p btn-sm" onClick={handleDownloadLetter} disabled={exporting !== null} style={{ minWidth: 140 }}>
                      {exporting === "letter" ? <><span className="spin" /> {t("preview.creatingPdf")}</> : <>{t("preview.downloadLetter")}</>}
                    </button>
                    <button className="btn btn-g btn-sm" onClick={() => downloadDocx("cover-letter")} disabled={exporting !== null} title="Als Word-Datei (.docx) herunterladen" style={{ minWidth: 140 }}>
                      {exporting === "letter-docx" ? <><span className="spin" /> Word…</> : <>⬇ Anschreiben .docx</>}
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
                  {t("preview.ats.keywords")}: <b style={{ color: "var(--text2)" }}>{ats.keywordScore}%</b> · {t("preview.ats.structure")}: <b style={{ color: "var(--text2)" }}>{ats.sectionScore}%</b>
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
          <>
            {/* CV — contentEditable so user can fine-tune before PDF export */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700 }}>{t("preview.cv")}</h3>
                <span style={{ fontSize: 12, color: "var(--muted)", background: "var(--bg2)", padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)" }}>
                  {t("preview.editCvHint")}
                </span>
              </div>
              <div className="cv-wrap" ref={cvWrapRef}>
                <div
                  ref={cvRef}
                  className="cv-sheet"
                  contentEditable
                  suppressContentEditableWarning
                  style={{ outline: "none" }}
                />
              </div>
            </div>

            {/* Cover letter — editable textarea */}
            {((doc as any)?.cover_letter || editedLetter) && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700 }}>{t("preview.coverLetter")}</h3>
                  <span style={{ fontSize: 12, color: "var(--muted)", background: "var(--bg2)", padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)" }}>
                    {t("preview.editLetterHint")}
                  </span>
                </div>
                <textarea
                  className="card"
                  value={editedLetter}
                  onChange={e => setEditedLetter(e.target.value)}
                  style={{
                    whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8, color: "var(--text2)",
                    width: "100%", border: "1px solid var(--border)", resize: "vertical",
                    minHeight: 320, padding: "1.25rem", fontFamily: "inherit",
                    borderRadius: 14, background: "var(--card)", display: "block", boxSizing: "border-box",
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
