import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { customFetch } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { FileImportButton, type UploadedFile } from "../components/FileImportButton";

export default function ImportPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [lastFile, setLastFile] = useState<UploadedFile | null>(null);
  const [styleBusy, setStyleBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const hasText = text.trim().length >= 80;

  function goScan(mode: "cv" | "letter") {
    try {
      sessionStorage.setItem("bk_scan_text", text.trim());
      sessionStorage.setItem("bk_scan_mode", mode);
    } catch { /* ignore */ }
    navigate("/scanner");
  }

  function goWizard() {
    try { sessionStorage.setItem("bk_prefill_text", text.trim()); } catch { /* ignore */ }
    navigate("/wizard");
  }

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
      } else setErrorMsg(t("scanner.styleError"));
    } catch {
      setErrorMsg(t("scanner.styleError"));
    } finally { setStyleBusy(false); }
  }

  const actionCard = (emoji: string, title: string, desc: string, onClick: () => void, disabled: boolean, busy?: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card"
      style={{ textAlign: "start", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, display: "flex", gap: 12, alignItems: "flex-start", width: "100%" }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{busy ? <span className="spin" /> : emoji}</span>
      <span>
        <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>{title}</span>
        <span style={{ display: "block", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</span>
      </span>
    </button>
  );

  return (
    <Layout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px 60px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>📥 {t("importPage.title")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 22 }}>{t("importPage.subtitle")}</p>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <label style={{ fontWeight: 700, fontSize: 14 }}>{t("importPage.textLabel")}</label>
            <FileImportButton onText={(txt) => setText(txt)} onFile={(f) => setLastFile(f)} />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("importPage.placeholder")}
            rows={10}
            style={{ width: "100%", resize: "vertical", fontSize: 13.5, lineHeight: 1.6, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }}
          />
          {errorMsg && <div style={{ color: "var(--err)", fontSize: 13.5, marginTop: 10 }}>{errorMsg}</div>}
        </div>

        <div style={{ fontWeight: 700, fontSize: 15, margin: "22px 0 10px" }}>{t("importPage.whatNext")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {actionCard("🔎", t("importPage.actCv"), t("importPage.actCvDesc"), () => goScan("cv"), !hasText)}
          {actionCard("✉️", t("importPage.actLetter"), t("importPage.actLetterDesc"), () => goScan("letter"), !hasText)}
          {actionCard("📝", t("importPage.actTemplate"), t("importPage.actTemplateDesc"), goWizard, !hasText)}
          {actionCard("🎨", t("importPage.actStyle"), t("importPage.actStyleDesc"), useStyle, !lastFile || styleBusy, styleBusy)}
        </div>
      </div>
    </Layout>
  );
}
