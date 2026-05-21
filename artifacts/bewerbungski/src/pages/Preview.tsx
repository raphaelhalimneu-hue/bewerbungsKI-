import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useGetDocument } from "@workspace/api-client-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Preview() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: doc, isLoading, error } = useGetDocument(params.id ?? "");
  const cvRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleDownloadPDF() {
    if (!cvRef.current) return;
    setExporting(true);
    try {
      const el = cvRef.current;

      const canvas = await html2canvas(el, {
        scale: 2,
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

      const fileName = (doc as any)?.name
        ? `${(doc as any).name.replace(/[^a-zA-Z0-9\-_äöüÄÖÜß ]/g, "")}.pdf`
        : "lebenslauf.pdf";
      pdf.save(fileName);
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Layout>
      <div className="fade">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <button className="btn btn-g" onClick={() => navigate("/documents")}>← Zurück</button>
          {doc && (
            <>
              <h2 style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, flex: 1, minWidth: 0 }}>
                {(doc as any).name}
              </h2>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="btn btn-s btn-sm" onClick={() => window.print()}>
                  🖨 Drucken
                </button>
                <button
                  className="btn btn-p btn-sm"
                  onClick={handleDownloadPDF}
                  disabled={exporting}
                  style={{ minWidth: 140 }}
                >
                  {exporting ? (
                    <><span className="spin" /> PDF wird erstellt …</>
                  ) : (
                    <>⬇ PDF herunterladen</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {isLoading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
            <span className="spin" /> Lädt …
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 20, color: "var(--err)" }}>
            Dokument konnte nicht geladen werden.
          </div>
        )}

        {doc && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                📋 Lebenslauf
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
                  ✉️ Anschreiben
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
