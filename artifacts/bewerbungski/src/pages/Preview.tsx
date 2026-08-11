import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useGetDocument } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Preview() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: doc, isLoading, error } = useGetDocument(params.id ?? "");
  const cvRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"cv" | "letter" | null>(null);

  function baseFileName(suffix: string) {
    const name = (doc as any)?.name
      ? (doc as any).name.replace(/[^a-zA-Z0-9\-_äöüÄÖÜß ]/g, "")
      : "";
    return `${name ? name + " – " : ""}${suffix}.pdf`;
  }

  async function handleDownloadCv() {
    if (!cvRef.current) return;
    setExporting("cv");
    try {
      const el = cvRef.current;

      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 794,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

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

      pdf.save(baseFileName("Lebenslauf"));
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(null);
    }
  }

  function handleDownloadLetter() {
    const coverLetter = ((doc as any)?.cover_letter || "").trim();
    if (!coverLetter) return;
    setExporting("letter");
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 22;
      const maxWidth = pageWidth - margin * 2;
      const lineHeight = 6.2;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      let y = margin;
      for (const para of coverLetter.split(/\n/)) {
        const lines: string[] = para.trim() === "" ? [""] : pdf.splitTextToSize(para, maxWidth);
        for (const line of lines) {
          if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          if (line !== "") pdf.text(line, margin, y);
          y += lineHeight;
        }
      }
      pdf.save(baseFileName("Anschreiben"));
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(null);
    }
  }

  return (
    <Layout>
      <div className="fade">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <button className="btn btn-g" onClick={() => navigate("/documents")}>{t("preview.back")}</button>
          {doc && (
            <>
              <h2 style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, flex: 1, minWidth: 0 }}>
                {(doc as any).name}
              </h2>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="btn btn-s btn-sm" onClick={() => window.print()}>
                  {t("preview.print")}
                </button>
                <button
                  className="btn btn-p btn-sm"
                  onClick={handleDownloadCv}
                  disabled={exporting !== null}
                  style={{ minWidth: 140 }}
                >
                  {exporting === "cv" ? (
                    <><span className="spin" /> {t("preview.creatingPdf")}</>
                  ) : (
                    <>{t("preview.downloadCv")}</>
                  )}
                </button>
                {(doc as any)?.cover_letter && (
                  <button
                    className="btn btn-p btn-sm"
                    onClick={handleDownloadLetter}
                    disabled={exporting !== null}
                    style={{ minWidth: 140 }}
                  >
                    {exporting === "letter" ? (
                      <><span className="spin" /> {t("preview.creatingPdf")}</>
                    ) : (
                      <>{t("preview.downloadLetter")}</>
                    )}
                  </button>
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

        {doc && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                {t("preview.cv")}
              </h3>
              <div className="cv-wrap">
                <div
                  ref={cvRef}
                  className="cv-sheet"
                  dangerouslySetInnerHTML={{ __html: (doc as any).cv_html || "" }}
                />
              </div>
            </div>

            {(doc as any).cover_letter && (
              <div>
                <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                  {t("preview.coverLetter")}
                </h3>
                <div
                  className="card"
                  style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8, color: "var(--text2)" }}
                >
                  {(doc as any).cover_letter}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
