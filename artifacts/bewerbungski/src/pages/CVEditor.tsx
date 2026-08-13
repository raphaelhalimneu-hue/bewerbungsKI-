import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { useGetDocument } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { renderCVContent, type CVContent, type TemplateId } from "../lib/buildCVHTML";

// ── Template list ────────────────────────────────────────────────────────────
const TEMPLATES: { id: TemplateId; name: string; color: string }[] = [
  { id: "modern",    name: "Modern",    color: "#111827" },
  { id: "classic",   name: "Classic",   color: "#0f172a" },
  { id: "creative",  name: "Creative",  color: "#1e3a5f" },
  { id: "executive", name: "Executive", color: "#1f2937" },
  { id: "minimal",   name: "Minimal",   color: "#111827" },
  { id: "elegant",   name: "Elegant",   color: "#92400e" },
  { id: "bold",      name: "Bold",      color: "#0f172a" },
  { id: "compact",   name: "Compact",   color: "#1f2937" },
  { id: "swiss",     name: "Swiss",     color: "#dc2626" },
  { id: "nordic",    name: "Nordic",    color: "#0e7490" },
  { id: "corporate", name: "Corporate", color: "#166534" },
  { id: "timeline",  name: "Timeline",  color: "#c2410c" },
  { id: "slate",     name: "Slate",     color: "#1e293b" },
  { id: "terra",     name: "Terra",     color: "#78350f" },
];

// ── Default empty CVContent ──────────────────────────────────────────────────
function emptyCV(): CVContent {
  return {
    name: "", title: "", contact: "", profile: "",
    experience: [], education: [], skills: [], languages: [], signature: "",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

export default function CVEditor() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: doc, isLoading, error } = useGetDocument(params.id ?? "");

  const [cvState, setCvState] = useState<CVContent>(emptyCV());
  const [template, setTemplate] = useState<TemplateId>("modern");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);
  const cvSheetRef = useRef<HTMLDivElement>(null);
  const cvWrapRef = useRef<HTMLDivElement>(null);

  // Initialise from doc
  useEffect(() => {
    if (!doc) return;
    const d = doc as any;
    if (d.cv_json) {
      setCvState(d.cv_json as CVContent);
    }
    if (d.template) setTemplate(d.template as TemplateId);
  }, [(doc as any)?.id]);

  // Scale preview to fit viewport
  useEffect(() => {
    function applyScale() {
      if (!cvWrapRef.current || !cvSheetRef.current) return;
      const available = cvWrapRef.current.clientWidth - 32;
      const cvWidth = 794;
      const scale = available < cvWidth ? available / cvWidth : 1;
      cvSheetRef.current.style.zoom = String(scale);
      cvWrapRef.current.style.minHeight = scale < 1
        ? `${cvSheetRef.current.offsetHeight * scale + 32}px`
        : "";
    }
    applyScale();
    window.addEventListener("resize", applyScale);
    return () => window.removeEventListener("resize", applyScale);
  }, [activeTab]);

  // Derived preview HTML
  const previewHtml = renderCVContent(cvState, template);

  // ── Helpers for array fields ─────────────────────────────────────────────
  function updateExp(idx: number, field: string, value: any) {
    setCvState(s => {
      const exp = s.experience.map((e, i) => i === idx ? { ...e, [field]: value } : e);
      return { ...s, experience: exp };
    });
  }
  function addExp() {
    setCvState(s => ({ ...s, experience: [...s.experience, { position: "", company: "", location: "", period: "", bullets: [""] }] }));
  }
  function removeExp(idx: number) {
    setCvState(s => ({ ...s, experience: s.experience.filter((_, i) => i !== idx) }));
  }
  function moveExp(idx: number, dir: -1 | 1) {
    setCvState(s => {
      const arr = [...s.experience];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return s;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...s, experience: arr };
    });
  }
  function updateExpBullet(eIdx: number, bIdx: number, val: string) {
    setCvState(s => {
      const exp = s.experience.map((e, i) => {
        if (i !== eIdx) return e;
        const bullets = e.bullets.map((b, j) => j === bIdx ? val : b);
        return { ...e, bullets };
      });
      return { ...s, experience: exp };
    });
  }
  function addBullet(eIdx: number) {
    setCvState(s => {
      const exp = s.experience.map((e, i) => i !== eIdx ? e : { ...e, bullets: [...e.bullets, ""] });
      return { ...s, experience: exp };
    });
  }
  function removeBullet(eIdx: number, bIdx: number) {
    setCvState(s => {
      const exp = s.experience.map((e, i) => i !== eIdx ? e : { ...e, bullets: e.bullets.filter((_, j) => j !== bIdx) });
      return { ...s, experience: exp };
    });
  }

  function updateEdu(idx: number, field: string, value: any) {
    setCvState(s => {
      const education = s.education.map((e, i) => i === idx ? { ...e, [field]: value } : e);
      return { ...s, education };
    });
  }
  function addEdu() {
    setCvState(s => ({ ...s, education: [...s.education, { degree: "", institution: "", location: "", period: "", note: "" }] }));
  }
  function removeEdu(idx: number) {
    setCvState(s => ({ ...s, education: s.education.filter((_, i) => i !== idx) }));
  }
  function moveEdu(idx: number, dir: -1 | 1) {
    setCvState(s => {
      const arr = [...s.education];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return s;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...s, education: arr };
    });
  }

  function addSkill() {
    const val = window.prompt(t("editor.skillPrompt") || "Skill hinzufügen:");
    if (val?.trim()) setCvState(s => ({ ...s, skills: [...s.skills, val.trim()] }));
  }
  function removeSkill(idx: number) {
    setCvState(s => ({ ...s, skills: s.skills.filter((_, i) => i !== idx) }));
  }

  function addLang() {
    setCvState(s => ({ ...s, languages: [...s.languages, { name: "", level: "" }] }));
  }
  function removeLang(idx: number) {
    setCvState(s => ({ ...s, languages: s.languages.filter((_, i) => i !== idx) }));
  }
  function updateLang(idx: number, field: "name" | "level", val: string) {
    setCvState(s => ({
      ...s,
      languages: s.languages.map((l, i) => i !== idx ? l : { ...l, [field]: val }),
    }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const html = renderCVContent(cvState, template);
      await customFetch(`/api/documents/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ cv_json: cvState, cv_html: html, template }),
      });
      setSaveMsg("✓ " + (t("editor.saved") || "Gespeichert"));
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e: any) {
      setSaveMsg("⚠ " + (e.message || "Fehler"));
    } finally {
      setSaving(false);
    }
  }

  // ── PDF export ───────────────────────────────────────────────────────────
  async function handleDownloadPdf() {
    if (!cvSheetRef.current) return;
    setExporting("pdf");
    try {
      const el = cvSheetRef.current;
      const canvas = await html2canvas(el, {
        scale: 3, useCORS: true, backgroundColor: "#ffffff",
        logging: false, windowWidth: 794,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let left = imgH; let yOff = 0;
      pdf.addImage(imgData, "PNG", 0, yOff, pageW, imgH);
      left -= pageH;
      while (left > 0) {
        yOff -= pageH; pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, yOff, pageW, imgH);
        left -= pageH;
      }
      const name = (doc as any)?.name?.replace(/[^a-zA-Z0-9\-_äöüÄÖÜß ]/g, "") || "";
      pdf.save(`${name ? name + " – " : ""}Lebenslauf.pdf`);
    } catch (e) { console.error("PDF export failed", e); }
    finally { setExporting(null); }
  }

  // ── DOCX export ──────────────────────────────────────────────────────────
  async function handleDownloadDocx() {
    setExporting("docx");
    try {
      const blob = await customFetch<Blob>(`/api/documents/${params.id}/download/cv.docx`, {
        method: "POST",
        body: JSON.stringify({ cv_json: cvState, template }),
        responseType: "blob",
      });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const name = (doc as any)?.name?.replace(/[^a-zA-Z0-9\-_äöüÄÖÜß ]/g, "") || "";
      a.download = `${name ? name + " – " : ""}Lebenslauf.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) { console.error("DOCX export failed", e); }
    finally { setExporting(null); }
  }

  // ── No cv_json fallback ──────────────────────────────────────────────────
  const hasCvJson = !!(doc as any)?.cv_json;

  // ── Mobile detection ─────────────────────────────────────────────────────
  const isMobile = typeof window !== "undefined" && window.innerWidth < 900;

  if (isLoading) {
    return (
      <Layout>
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
          <span className="spin" /> {t("preview.loading")}
        </div>
      </Layout>
    );
  }
  if (error || !doc) {
    return (
      <Layout>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 20, color: "var(--err)" }}>
          {t("preview.loadError")}
        </div>
      </Layout>
    );
  }

  if (!hasCvJson) {
    return (
      <Layout>
        <div className="fade">
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
            <button className="btn btn-g" onClick={() => navigate(`/preview/${params.id}`)}>{t("preview.back")}</button>
            <h2 style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700 }}>{t("editor.noJsonTitle") || "Strukturierter Editor"}</h2>
          </div>
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <h3 style={{ marginBottom: 8 }}>{t("editor.noJsonTitle") || "Kein strukturierter Editor verfügbar"}</h3>
            <p style={{ color: "var(--muted)", marginBottom: 20 }}>
              {t("editor.noJsonText") || "Dieses Dokument wurde ohne strukturierte Daten erstellt. Bearbeite es auf der Vorschau-Seite."}
            </p>
            <button className="btn btn-p" onClick={() => navigate(`/preview/${params.id}`)}>
              {t("editor.backToPreview") || "Zur Vorschau"}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Form Panel ───────────────────────────────────────────────────────────
  const FormPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", flex: 1, padding: "0 0 80px" }}>

      {/* Contact & Name */}
      <section style={sectionStyle}>
        <div style={sectionHeader}>{t("editor.sectionContact") || "Name & Kontakt"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FieldRow label={t("editor.name") || "Name"}>
            <input className="input" value={cvState.name} onChange={e => setCvState(s => ({ ...s, name: e.target.value }))} placeholder="Max Mustermann" />
          </FieldRow>
          <FieldRow label={t("editor.jobTitle") || "Berufsbezeichnung"}>
            <input className="input" value={cvState.title} onChange={e => setCvState(s => ({ ...s, title: e.target.value }))} placeholder="Senior Software Engineer" />
          </FieldRow>
          <FieldRow label={t("editor.contact") || "Kontakt"}>
            <input className="input" value={cvState.contact} onChange={e => setCvState(s => ({ ...s, contact: e.target.value }))} placeholder="Berlin · +49 … · mail@mail.de" />
          </FieldRow>
          <FieldRow label={t("editor.signature") || "Signatur"}>
            <input className="input" value={cvState.signature} onChange={e => setCvState(s => ({ ...s, signature: e.target.value }))} placeholder="Berlin, den 1. August 2026 – Max Mustermann" />
          </FieldRow>
        </div>
      </section>

      {/* Profil / Zusammenfassung */}
      <section style={sectionStyle}>
        <div style={sectionHeader}>{t("editor.sectionProfile") || "Profil / Zusammenfassung"}</div>
        <textarea
          className="textarea"
          value={cvState.profile}
          onChange={e => setCvState(s => ({ ...s, profile: e.target.value }))}
          placeholder={t("editor.profilePh") || "2–4 Sätze über dich und deine Stärken …"}
          style={{ minHeight: 90 }}
        />
      </section>

      {/* Berufserfahrung */}
      <section style={sectionStyle}>
        <div style={{ ...sectionHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{t("editor.sectionExp") || "Berufserfahrung"}</span>
          <button className="btn btn-s btn-sm" onClick={addExp} style={{ fontSize: 12 }}>+ {t("editor.addExp") || "Hinzufügen"}</button>
        </div>
        {cvState.experience.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>{t("editor.expEmpty") || "Noch keine Einträge."}</div>
        )}
        {cvState.experience.map((exp, eIdx) => (
          <div key={eIdx} style={entryCard}>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
              <button className="btn btn-g btn-sm" style={{ padding: "3px 8px" }} onClick={() => moveExp(eIdx, -1)} disabled={eIdx === 0} title="Nach oben">↑</button>
              <button className="btn btn-g btn-sm" style={{ padding: "3px 8px" }} onClick={() => moveExp(eIdx, 1)} disabled={eIdx === cvState.experience.length - 1} title="Nach unten">↓</button>
              <button className="btn btn-d btn-sm" style={{ padding: "3px 8px" }} onClick={() => removeExp(eIdx)}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FieldRow label={t("editor.position") || "Position"}>
                <input className="input" value={exp.position} onChange={e => updateExp(eIdx, "position", e.target.value)} placeholder="Senior Developer" />
              </FieldRow>
              <FieldRow label={t("editor.company") || "Unternehmen"}>
                <input className="input" value={exp.company} onChange={e => updateExp(eIdx, "company", e.target.value)} placeholder="Musterfirma GmbH" />
              </FieldRow>
              <FieldRow label={t("editor.location") || "Ort"}>
                <input className="input" value={exp.location} onChange={e => updateExp(eIdx, "location", e.target.value)} placeholder="Berlin" />
              </FieldRow>
              <FieldRow label={t("editor.period") || "Zeitraum"}>
                <input className="input" value={exp.period} onChange={e => updateExp(eIdx, "period", e.target.value)} placeholder="01/2021 – heute" />
              </FieldRow>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>{t("editor.bullets") || "Aufgaben / Bullet-Points"}</div>
              {exp.bullets.map((b, bIdx) => (
                <div key={bIdx} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <input
                    className="input"
                    value={b}
                    onChange={e => updateExpBullet(eIdx, bIdx, e.target.value)}
                    placeholder={t("editor.bulletPh") || "Aufgabe oder Erfolg …"}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-g btn-sm" style={{ padding: "3px 8px" }} onClick={() => removeBullet(eIdx, bIdx)}>×</button>
                </div>
              ))}
              <button className="btn btn-g btn-sm" style={{ fontSize: 12, marginTop: 2 }} onClick={() => addBullet(eIdx)}>
                + {t("editor.addBullet") || "Bullet hinzufügen"}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Ausbildung */}
      <section style={sectionStyle}>
        <div style={{ ...sectionHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{t("editor.sectionEdu") || "Ausbildung"}</span>
          <button className="btn btn-s btn-sm" onClick={addEdu} style={{ fontSize: 12 }}>+ {t("editor.addEdu") || "Hinzufügen"}</button>
        </div>
        {cvState.education.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>{t("editor.eduEmpty") || "Noch keine Einträge."}</div>
        )}
        {cvState.education.map((edu, eIdx) => (
          <div key={eIdx} style={entryCard}>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
              <button className="btn btn-g btn-sm" style={{ padding: "3px 8px" }} onClick={() => moveEdu(eIdx, -1)} disabled={eIdx === 0}>↑</button>
              <button className="btn btn-g btn-sm" style={{ padding: "3px 8px" }} onClick={() => moveEdu(eIdx, 1)} disabled={eIdx === cvState.education.length - 1}>↓</button>
              <button className="btn btn-d btn-sm" style={{ padding: "3px 8px" }} onClick={() => removeEdu(eIdx)}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FieldRow label={t("editor.degree") || "Abschluss"}>
                <input className="input" value={edu.degree} onChange={e => updateEdu(eIdx, "degree", e.target.value)} placeholder="B.Sc. Informatik" />
              </FieldRow>
              <FieldRow label={t("editor.institution") || "Hochschule / Schule"}>
                <input className="input" value={edu.institution} onChange={e => updateEdu(eIdx, "institution", e.target.value)} placeholder="TU Berlin" />
              </FieldRow>
              <FieldRow label={t("editor.location") || "Ort"}>
                <input className="input" value={edu.location} onChange={e => updateEdu(eIdx, "location", e.target.value)} placeholder="Berlin" />
              </FieldRow>
              <FieldRow label={t("editor.period") || "Zeitraum"}>
                <input className="input" value={edu.period} onChange={e => updateEdu(eIdx, "period", e.target.value)} placeholder="10/2018 – 03/2022" />
              </FieldRow>
              <FieldRow label={t("editor.note") || "Anmerkung (Note, etc.)"}>
                <input className="input" value={edu.note} onChange={e => updateEdu(eIdx, "note", e.target.value)} placeholder="Note: 1,8" />
              </FieldRow>
            </div>
          </div>
        ))}
      </section>

      {/* Skills */}
      <section style={sectionStyle}>
        <div style={{ ...sectionHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{t("editor.sectionSkills") || "Kenntnisse"}</span>
          <button className="btn btn-s btn-sm" onClick={addSkill} style={{ fontSize: 12 }}>+ {t("editor.addSkill") || "Hinzufügen"}</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, paddingTop: 4 }}>
          {cvState.skills.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("editor.skillsEmpty") || "Noch keine Kenntnisse."}</div>
          )}
          {cvState.skills.map((s, i) => (
            <span key={i} style={{ background: "var(--brand-l)", color: "var(--brand)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {typeof s === "string" ? s : (s as any).name}
              <button onClick={() => removeSkill(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontWeight: 700, padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
            </span>
          ))}
        </div>
      </section>

      {/* Languages */}
      <section style={sectionStyle}>
        <div style={{ ...sectionHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{t("editor.sectionLangs") || "Sprachen"}</span>
          <button className="btn btn-s btn-sm" onClick={addLang} style={{ fontSize: 12 }}>+ {t("editor.addLang") || "Hinzufügen"}</button>
        </div>
        {cvState.languages.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>{t("editor.langsEmpty") || "Noch keine Sprachen."}</div>
        )}
        {cvState.languages.map((lang, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <input className="input" value={lang.name} onChange={e => updateLang(i, "name", e.target.value)} placeholder={t("editor.langName") || "Deutsch"} style={{ flex: 1 }} />
            <select className="select" value={lang.level} onChange={e => updateLang(i, "level", e.target.value)} style={{ flex: 1 }}>
              <option value="">Niveau …</option>
              <option value="Muttersprache">Muttersprache</option>
              <option value="C2 – Verhandlungssicher">C2 – Verhandlungssicher</option>
              <option value="C1 – Sehr gut">C1 – Sehr gut</option>
              <option value="B2 – Gut">B2 – Gut</option>
              <option value="B1 – Grundkenntnisse">B1 – Grundkenntnisse</option>
              <option value="A2 – Basiskenntnisse">A2 – Basiskenntnisse</option>
            </select>
            <button className="btn btn-d btn-sm" style={{ padding: "5px 10px" }} onClick={() => removeLang(i)}>×</button>
          </div>
        ))}
      </section>

      {/* Template Switcher */}
      <section style={sectionStyle}>
        <div style={sectionHeader}>{t("editor.sectionTemplate") || "Vorlage wechseln"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {TEMPLATES.map(tpl => {
            const active = template === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => setTemplate(tpl.id)}
                style={{
                  border: active ? `2px solid var(--brand)` : "2px solid var(--border)",
                  borderRadius: 10, padding: "10px 6px", cursor: "pointer",
                  background: active ? "var(--brand-l)" : "var(--bg2)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  transition: "all .15s",
                }}
              >
                <div style={{ width: 28, height: 36, background: tpl.color, borderRadius: 3 }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: active ? "var(--brand)" : "var(--text2)" }}>{tpl.name}</div>
                {active && <div style={{ fontSize: 10, color: "var(--brand)" }}>✓</div>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  // ── Preview Panel ─────────────────────────────────────────────────────────
  const PreviewPanel = () => (
    <div className="cv-wrap" ref={cvWrapRef} style={{ flex: 1, padding: 16, overflowX: "auto" }}>
      <div
        ref={cvSheetRef}
        className="cv-sheet"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
        style={{ width: 794, margin: "0 auto" }}
      />
    </div>
  );

  return (
    <Layout>
      <div className="fade" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
        {/* ── Top bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap", flexShrink: 0 }}>
          <button className="btn btn-g" onClick={() => navigate(`/preview/${params.id}`)} style={{ flexShrink: 0 }}>
            {t("preview.back")}
          </button>
          <h2 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(doc as any).name}
          </h2>
          {saveMsg && <span style={{ fontSize: 13, color: "var(--ok)", fontWeight: 600 }}>{saveMsg}</span>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
            <button className="btn btn-s btn-sm" onClick={handleSave} disabled={saving} style={{ minWidth: 90 }}>
              {saving ? <><span className="spin" /> …</> : (t("editor.save") || "💾 Speichern")}
            </button>
            <button className="btn btn-p btn-sm" onClick={handleDownloadPdf} disabled={exporting !== null} style={{ minWidth: 120 }}>
              {exporting === "pdf" ? <><span className="spin" /> PDF…</> : "⬇ PDF"}
            </button>
            <button className="btn btn-g btn-sm" onClick={handleDownloadDocx} disabled={exporting !== null} style={{ minWidth: 120 }}>
              {exporting === "docx" ? <><span className="spin" /> Word…</> : "⬇ DOCX"}
            </button>
          </div>
        </div>

        {/* ── Mobile tabs ── */}
        <div style={{ display: "none" }} className="editor-tabs-mobile">
          {/* rendered via CSS media query below */}
        </div>
        <div style={{ display: "flex", gap: 0, marginBottom: 10, flexShrink: 0 }} className="editor-mobile-tabs">
          <button
            className={activeTab === "edit" ? "btn btn-p btn-sm" : "btn btn-g btn-sm"}
            onClick={() => setActiveTab("edit")}
            style={{ flex: 1, borderRadius: "10px 0 0 10px", justifyContent: "center" }}
          >
            ✏️ {t("editor.tabEdit") || "Bearbeiten"}
          </button>
          <button
            className={activeTab === "preview" ? "btn btn-p btn-sm" : "btn btn-g btn-sm"}
            onClick={() => setActiveTab("preview")}
            style={{ flex: 1, borderRadius: "0 10px 10px 0", justifyContent: "center" }}
          >
            👁 {t("editor.tabPreview") || "Vorschau"}
          </button>
        </div>

        {/* ── Main two-column layout ── */}
        <div style={{ display: "flex", gap: 0, flex: 1, overflow: "hidden", minHeight: 0 }} className="editor-main">
          {/* Left: form */}
          <div
            className="editor-form-panel"
            style={{
              width: 360, minWidth: 320, flexShrink: 0,
              borderRight: "1px solid var(--border)",
              overflowY: "auto", background: "var(--bg2)",
            }}
          >
            <FormPanel />
          </div>
          {/* Right: preview */}
          <div
            className="editor-preview-panel"
            style={{ flex: 1, overflowY: "auto", background: "var(--bg3)" }}
            ref={previewRef}
          >
            <PreviewPanel />
          </div>
        </div>
      </div>

      {/* Responsive CSS injected inline */}
      <style>{`
        @media (max-width: 860px) {
          .editor-main { flex-direction: column !important; }
          .editor-form-panel {
            width: 100% !important; min-width: 0 !important;
            border-right: none !important; border-bottom: 1px solid var(--border);
            display: ${activeTab === "edit" ? "block" : "none"} !important;
            max-height: 60vh; overflow-y: auto;
          }
          .editor-preview-panel {
            display: ${activeTab === "preview" ? "block" : "none"} !important;
            flex: 1 !important;
          }
        }
        @media (min-width: 861px) {
          .editor-mobile-tabs { display: none !important; }
          .editor-form-panel { display: block !important; }
          .editor-preview-panel { display: block !important; }
        }
      `}</style>
    </Layout>
  );
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const sectionStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  padding: "16px 16px 18px",
};
const sectionHeader: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "var(--text2)",
  textTransform: "uppercase", letterSpacing: ".06em",
  marginBottom: 12,
};
const entryCard: React.CSSProperties = {
  background: "var(--bg3)", border: "1px solid var(--border)",
  borderRadius: 10, padding: 12, marginBottom: 10,
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
