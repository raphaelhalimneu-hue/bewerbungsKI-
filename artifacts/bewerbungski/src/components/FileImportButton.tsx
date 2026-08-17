import { useRef, useState } from "react";
import { FiUpload } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "../context/AuthContext";
import { compressImageIfNeeded } from "../lib/compressImage";

const ACCEPT = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp";
const MAX_BYTES = 15 * 1024 * 1024;

export type UploadedFile = { base64: string; mimeType: string; filename: string };

/** Upload a PDF/DOCX/TXT/photo and get its text back (photos via AI OCR). */
export function FileImportButton({ onText, onFile }: { onText: (text: string) => void; onFile?: (file: UploadedFile) => void }) {
  const { t } = useTranslation();
  const { user, setShowAuthModal } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(file: File) {
    setErr("");
    file = await compressImageIfNeeded(file, MAX_BYTES);
    if (file.size > MAX_BYTES) { setErr(t("fileImport.tooLarge")); return; }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(bin);
      let mimeType = file.type;
      if (!mimeType) {
        const n = file.name.toLowerCase();
        mimeType = n.endsWith(".pdf") ? "application/pdf"
          : n.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : n.endsWith(".txt") ? "text/plain"
          : n.endsWith(".png") ? "image/png"
          : n.endsWith(".webp") ? "image/webp"
          : "image/jpeg";
      }
      if (onFile && (mimeType.startsWith("image/") || mimeType === "application/pdf")) {
        onFile({ base64, mimeType, filename: file.name });
      }
      const res: any = await customFetch("/api/extract", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType, data: base64 }),
      });
      if (res?.text) onText(res.text);
      else setErr(t("fileImport.noText"));
    } catch (e: any) {
      const msg = String(e?.message || "");
      const status = e?.status ?? (msg.match(/\b(4\d\d|5\d\d)\b/)?.[1] ? Number(msg.match(/\b(4\d\d|5\d\d)\b/)![1]) : 0);
      setErr(status === 429 ? t("fileImport.limit") : status === 422 ? t("fileImport.noText") : status === 413 ? t("fileImport.tooLarge") : t("fileImport.error"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <button
        type="button"
        className="btn btn-g btn-sm"
        disabled={busy}
        onClick={() => { if (!user) { setShowAuthModal(true); return; } inputRef.current?.click(); }}
      >
        {busy ? <><span className="spin" /> {t("fileImport.reading")}</> : <><FiUpload size={14} /> {t("fileImport.button")}</>}
      </button>
      {err && <span style={{ color: "var(--err)", fontSize: 12.5 }}>{err}</span>}
    </span>
  );
}
