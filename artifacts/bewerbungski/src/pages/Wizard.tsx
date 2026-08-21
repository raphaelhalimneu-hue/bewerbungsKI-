import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useGenerateDocument, useCreateDocument, customFetch } from "@workspace/api-client-react";
import type { FormData, Experience, Education, Skill, Language, TemplateId, CVContent } from "../lib/buildCVHTML";
import { renderCVContent, letterheadUrl } from "../lib/buildCVHTML";
import { computeAtsScore } from "../lib/atsScore";
import { compressImageIfNeeded } from "../lib/compressImage";
import { FileImportButton } from "../components/FileImportButton";
import { applyImportedStyle, takeWizardDesign, takeWizardPrefill } from "../lib/importHandoff";

const STEPS = [
  { id: "personal",   icon: "👤" },
  { id: "school",     icon: "🏫" },
  { id: "education",  icon: "🎓" },
  { id: "experience", icon: "💼" },
  { id: "skills",     icon: "⚡" },
  { id: "languages",  icon: "🌍" },
  { id: "jobad",      icon: "📋" },
  { id: "template",   icon: "🎨" },
  { id: "generate",   icon: "✨" },
];

// Visual identity per template — injected into the AI prompt skeleton.
const TEMPLATE_STYLES: Record<TemplateId, { font: string; accent: string; headerBg: string; headerText: string; subColor: string; chipBg: string; chipText: string; scale: number }> = {
  modern:    { font: "Helvetica,Arial,sans-serif", accent: "#1f2937", headerBg: "transparent", headerText: "#1f2937", subColor: "#6b7280", chipBg: "#f3f4f6", chipText: "#374151", scale: 1 },
  classic:   { font: "Georgia,'Times New Roman',serif", accent: "#111827", headerBg: "transparent", headerText: "#111827", subColor: "#4b5563", chipBg: "#f3f4f6", chipText: "#374151", scale: 1 },
  creative:  { font: "Helvetica,Arial,sans-serif", accent: "#7c3aed", headerBg: "transparent", headerText: "#1f2937", subColor: "#7c3aed", chipBg: "#f5f3ff", chipText: "#5b21b6", scale: 1 },
  executive: { font: "Georgia,'Times New Roman',serif", accent: "#1e3a8a", headerBg: "transparent", headerText: "#1e3a8a", subColor: "#475569", chipBg: "#eff6ff", chipText: "#1e40af", scale: 1 },
  minimal:   { font: "Helvetica,Arial,sans-serif", accent: "#9ca3af", headerBg: "transparent", headerText: "#111827", subColor: "#9ca3af", chipBg: "transparent", chipText: "#374151", scale: 1 },
  elegant:   { font: "Georgia,'Times New Roman',serif", accent: "#92400e", headerBg: "transparent", headerText: "#1f2937", subColor: "#92400e", chipBg: "#fffbeb", chipText: "#92400e", scale: 1 },
  bold:      { font: "Helvetica,Arial,sans-serif", accent: "#0f172a", headerBg: "#0f172a", headerText: "#ffffff", subColor: "#cbd5e1", chipBg: "#e2e8f0", chipText: "#0f172a", scale: 1 },
  compact:   { font: "Helvetica,Arial,sans-serif", accent: "#1f2937", headerBg: "transparent", headerText: "#1f2937", subColor: "#6b7280", chipBg: "#f3f4f6", chipText: "#374151", scale: 0.88 },
  swiss:     { font: "Helvetica,Arial,sans-serif", accent: "#dc2626", headerBg: "transparent", headerText: "#111111", subColor: "#dc2626", chipBg: "#fef2f2", chipText: "#dc2626", scale: 1 },
  nordic:    { font: "Helvetica,Arial,sans-serif", accent: "#0d9488", headerBg: "transparent", headerText: "#111827", subColor: "#0d9488", chipBg: "#f0fdfa", chipText: "#0d9488", scale: 1 },
  corporate: { font: "Helvetica,Arial,sans-serif", accent: "#065f46", headerBg: "#065f46", headerText: "#ffffff", subColor: "#10b981", chipBg: "#ecfdf5", chipText: "#065f46", scale: 1 },
  timeline:  { font: "Helvetica,Arial,sans-serif", accent: "#ea580c", headerBg: "transparent", headerText: "#111827", subColor: "#ea580c", chipBg: "#fff7ed", chipText: "#ea580c", scale: 1 },
  slate:     { font: "Helvetica,Arial,sans-serif", accent: "#334155", headerBg: "#334155", headerText: "#ffffff", subColor: "#64748b", chipBg: "#f8fafc", chipText: "#334155", scale: 1 },
  terra:     { font: "Georgia,'Times New Roman',serif", accent: "#c2410c", headerBg: "transparent", headerText: "#7c2d12", subColor: "#c2410c", chipBg: "#fff7ed", chipText: "#c2410c", scale: 1 },
  custom:    { font: "Helvetica,Arial,sans-serif", accent: "#1f2937", headerBg: "transparent", headerText: "#111827", subColor: "#6b7280", chipBg: "#f3f4f6", chipText: "#374151", scale: 1 },
  // Briefkopf-Designs (PNG-Hintergründe)
  blobs:         { font: "Helvetica,Arial,sans-serif", accent: "#d97b7b", headerBg: "transparent", headerText: "#111827", subColor: "#8a8a8a", chipBg: "#fbeaea", chipText: "#a85454", scale: 1 },
  welle:         { font: "Helvetica,Arial,sans-serif", accent: "#4a7cb5", headerBg: "transparent", headerText: "#111827", subColor: "#7a8aa0", chipBg: "#e7f0fa", chipText: "#33587f", scale: 1 },
  halo:          { font: "Helvetica,Arial,sans-serif", accent: "#c97a5a", headerBg: "transparent", headerText: "#111827", subColor: "#9a7a6a", chipBg: "#f7e8de", chipText: "#a85f3f", scale: 1 },
  splitblock:    { font: "Helvetica,Arial,sans-serif", accent: "#1a1a1a", headerBg: "transparent", headerText: "#111827", subColor: "#6b6b6b", chipBg: "#f0f0f0", chipText: "#1a1a1a", scale: 1 },
  klammern:      { font: "Helvetica,Arial,sans-serif", accent: "#1f4d47", headerBg: "transparent", headerText: "#111827", subColor: "#5f7a74", chipBg: "#e9efe9", chipText: "#1f4d47", scale: 1 },
  winkel:        { font: "Helvetica,Arial,sans-serif", accent: "#5c1a2b", headerBg: "transparent", headerText: "#111827", subColor: "#8a5f6b", chipBg: "#f4e8ec", chipText: "#5c1a2b", scale: 1 },
  bogen:         { font: "Georgia,'Times New Roman',serif", accent: "#b8873f", headerBg: "transparent", headerText: "#111827", subColor: "#8a7a5f", chipBg: "#f6eedd", chipText: "#8f6a2f", scale: 1 },
  zweig:         { font: "Georgia,'Times New Roman',serif", accent: "#1f3a5f", headerBg: "transparent", headerText: "#111827", subColor: "#5f708a", chipBg: "#e8edf5", chipText: "#1f3a5f", scale: 1 },
  berge:         { font: "Georgia,'Times New Roman',serif", accent: "#a8552f", headerBg: "transparent", headerText: "#111827", subColor: "#8a6f5f", chipBg: "#f5e9e2", chipText: "#a8552f", scale: 1 },
  konfetti:      { font: "Helvetica,Arial,sans-serif", accent: "#d94f4f", headerBg: "transparent", headerText: "#111827", subColor: "#7a7a7a", chipBg: "#fdecec", chipText: "#c23c3c", scale: 1 },
  wellenband:    { font: "Helvetica,Arial,sans-serif", accent: "#d16587", headerBg: "transparent", headerText: "#111827", subColor: "#8a7a80", chipBg: "#fdeef3", chipText: "#b54c6e", scale: 1 },
  farbkreis:     { font: "Helvetica,Arial,sans-serif", accent: "#e76f51", headerBg: "transparent", headerText: "#111827", subColor: "#8a7a70", chipBg: "#fdeee8", chipText: "#c25537", scale: 1 },
  blobcorner:    { font: "Helvetica,Arial,sans-serif", accent: "#7c6ff2", headerBg: "transparent", headerText: "#111827", subColor: "#8a85a8", chipBg: "#efecfd", chipText: "#5f52d4", scale: 1 },
  aurora:        { font: "Helvetica,Arial,sans-serif", accent: "#e05575", headerBg: "transparent", headerText: "#111827", subColor: "#9a7a80", chipBg: "#fdeef1", chipText: "#c23c5c", scale: 1 },
  prisma:        { font: "Helvetica,Arial,sans-serif", accent: "#2fb5a3", headerBg: "transparent", headerText: "#111827", subColor: "#6f8a85", chipBg: "#e6f7f3", chipText: "#1f8a7a", scale: 1 },
  verlaufswelle: { font: "Helvetica,Arial,sans-serif", accent: "#7c6ff2", headerBg: "transparent", headerText: "#111827", subColor: "#8a85a8", chipBg: "#efecfd", chipText: "#5f52d4", scale: 1 },
  blaupause:     { font: "Helvetica,Arial,sans-serif", accent: "#2b5a8c", headerBg: "transparent", headerText: "#111827", subColor: "#6f80a0", chipBg: "#e9f0f7", chipText: "#2b5a8c", scale: 1 },
  technik:       { font: "Helvetica,Arial,sans-serif", accent: "#3d3d3d", headerBg: "transparent", headerText: "#111827", subColor: "#7a7a7a", chipBg: "#efefef", chipText: "#3d3d3d", scale: 1 },
  raster:        { font: "Helvetica,Arial,sans-serif", accent: "#2f5940", headerBg: "transparent", headerText: "#111827", subColor: "#6f857a", chipBg: "#e9f1ec", chipText: "#2f5940", scale: 1 },
};

/** Style descriptor for the AI prompt — for "custom", derive it from the uploaded design. */
function styleFor(form: FormData) {
  if (form.template === "custom" && form.customStyle) {
    const cs = form.customStyle;
    return {
      font: cs.font === "serif" ? "Georgia,'Times New Roman',serif" : "Helvetica,Arial,sans-serif",
      accent: cs.accent, headerBg: cs.headerBg, headerText: cs.headerText,
      subColor: cs.subColor, chipBg: cs.chipBg, chipText: cs.chipText, scale: 1,
    };
  }
  return TEMPLATE_STYLES[form.template] || TEMPLATE_STYLES.modern;
}

function blankForm(): FormData {
  return {
    personal: { firstName: "", lastName: "", title: "", email: "", phone: "", address: "", zip: "", city: "", linkedin: "", website: "", summary: "" },
    school: { type: "", name: "", city: "", year: "" },
    experience: [],
    education: [],
    skills: [],
    languages: [],
    jobad: { title: "", company: "", address: "", description: "" },
    template: "blobs",
  };
}

export default function Wizard() {
  const [step, setStep] = useState(() => {
    const s = Number(new URLSearchParams(window.location.search).get("step"));
    return Number.isInteger(s) && s >= 0 && s <= 8 ? s : 0;
  });
  const [form, setForm] = useState<FormData>(blankForm());
  const [docLang, setDocLang] = useState("de");
  const [motivation, setMotivation] = useState("");
  const [achievement, setAchievement] = useState("");
  const [tone, setTone] = useState<"formell" | "modern" | "kreativ">("formell");
  const [generating, setGenerating] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const [genPhase, setGenPhase] = useState("");
  const { user, loading: authLoading, setShowAuthModal, refetchProfile } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const generateMutation = useGenerateDocument();
  const createMutation = useCreateDocument();
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Prefill custom design from Scanner ("use file design"): style JSON stored before navigation
  useEffect(() => {
    try {
      const style = takeWizardDesign(sessionStorage);
      if (style) {
        setCustomStyle(style);
        toast({ title: t("wizard.template.customReady") });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    customFetch<{ savedProfile: unknown }>("/api/saved-profile")
      .then(d => { if (d.savedProfile) setHasSavedProfile(true); })
      .catch(() => {});
  }, [user?.id]);

  async function loadProfile() {
    setProfileLoading(true);
    try {
      const d = await customFetch<{ savedProfile: Record<string, unknown> | null }>("/api/saved-profile");
      if (d.savedProfile) {
        const saved = d.savedProfile as any;
        setForm(f => ({
          ...saved,
          school: saved.school ?? { type: "", name: "", city: "", year: "" },
          jobad: f.jobad,
          template: f.template,
        }));
        setHasSavedProfile(false);
        toast({ title: t("wizard.profileLoaded") });
      }
    } catch { toast({ title: t("wizard.genError"), variant: "destructive" }); }
    finally { setProfileLoading(false); }
  }

  function setPersonal(key: string, value: string) {
    setForm(f => ({ ...f, personal: { ...f.personal, [key]: value } }));
  }
  function setSchool(key: string, value: string) {
    setForm(f => ({ ...f, school: { ...f.school, [key]: value } }));
  }
  function setJobad(key: string, value: string) {
    setForm(f => ({ ...f, jobad: { ...f.jobad, [key]: value } }));
  }
  function setTemplate(t: TemplateId) {
    setForm(f => ({ ...f, template: t }));
  }
  function setCustomStyle(cs: NonNullable<FormData["customStyle"]>) {
    setForm(f => applyImportedStyle(f, cs));
  }

  function addExp() {
    setForm(f => ({ ...f, experience: [...f.experience, { company: "", city: "", position: "", start: "", end: "", current: false, description: "" }] }));
  }
  function updateExp(i: number, key: string, value: string | boolean) {
    setForm(f => { const e = [...f.experience]; e[i] = { ...e[i], [key]: value }; return { ...f, experience: e }; });
  }
  function delExp(i: number) {
    setForm(f => ({ ...f, experience: f.experience.filter((_, idx) => idx !== i) }));
  }

  function addEdu() {
    setForm(f => ({ ...f, education: [...f.education, { institution: "", city: "", degree: "", field: "", grade: "", start: "", end: "" }] }));
  }
  function updateEdu(i: number, key: string, value: string) {
    setForm(f => { const e = [...f.education]; e[i] = { ...e[i], [key]: value }; return { ...f, education: e }; });
  }
  function delEdu(i: number) {
    setForm(f => ({ ...f, education: f.education.filter((_, idx) => idx !== i) }));
  }

  const [skillInput, setSkillInput] = useState("");
  const [skillLevel, setSkillLevel] = useState(80);
  function addSkill() {
    if (!skillInput.trim()) return;
    setForm(f => ({ ...f, skills: [...f.skills, { name: skillInput.trim(), level: skillLevel }] }));
    setSkillInput("");
  }
  function delSkill(i: number) {
    setForm(f => ({ ...f, skills: f.skills.filter((_, idx) => idx !== i) }));
  }

  function addLang() {
    setForm(f => ({ ...f, languages: [...f.languages, { language: "", level: "B2" }] }));
  }
  function updateLang(i: number, key: string, value: string) {
    setForm(f => { const l = [...f.languages]; l[i] = { ...l[i], [key]: value }; return { ...f, languages: l }; });
  }
  function delLang(i: number) {
    setForm(f => ({ ...f, languages: f.languages.filter((_, idx) => idx !== i) }));
  }

  // After the auth modal was opened by "Generate", continue automatically once the user is signed in.
  useEffect(() => {
    if (user && pendingGenerate && !generating) {
      setPendingGenerate(false);
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingGenerate]);

  async function handleGenerate() {
    if (!user) { setPendingGenerate(true); setShowAuthModal(true); return; }
    if (!form.personal.firstName || !form.personal.lastName) {
      toast({ title: t("wizard.nameRequired"), variant: "destructive" }); return;
    }
    setGenerating(true);
    try {
      const DOC_LANGS: Record<string, { name: string; locale: string; conventions: string }> = {
        de: { name: "Deutsch", locale: "de-DE", conventions: "Deutsche Bewerbungsstandards (DIN 5008, tabellarischer Lebenslauf)." },
        en: { name: "Englisch", locale: "en-GB", conventions: "Britisch/internationale CV-Standards: KEIN Foto, KEIN Geburtsdatum, KEIN Familienstand, keine Unterschriftszeile im CV; 'Curriculum Vitae' bzw. 'Cover Letter'." },
        tr: { name: "Türkisch", locale: "tr-TR", conventions: "Türkische Özgeçmiş-Standards." },
        ar: { name: "Arabisch", locale: "ar", conventions: "Arabische Lebenslauf-Standards; Text in korrektem Hocharabisch, Layout rechtsläufig gedacht." },
        es: { name: "Spanisch", locale: "es-ES", conventions: "Spanische CV-Standards (Currículum), kein Geburtsdatum nötig." },
        pl: { name: "Polnisch", locale: "pl-PL", conventions: "Polnische CV-Standards; übliche RODO/DSGVO-Einwilligungsklausel am Ende des CV." },
        ru: { name: "Russisch", locale: "ru-RU", conventions: "Russische Resume-Standards." },
        uk: { name: "Ukrainisch", locale: "uk-UA", conventions: "Ukrainische Resume-Standards." },
      };
      const lang = DOC_LANGS[docLang] || DOC_LANGS.de;
      const batchId = crypto.randomUUID();
      const ts = styleFor(form);
      const sz = (n: number) => Math.round(n * ts.scale * 10) / 10;
      const usePhoto = !!form.personal.photo && docLang !== "en";
      // Never send the base64 photo through the AI prompt — use a placeholder instead.
      const promptForm = { ...form, personal: { ...form.personal, photo: undefined } };
      const langInstr = docLang === "de" ? "" : ` WICHTIG: Schreibe den GESAMTEN Inhalt auf ${lang.name} (nicht auf Deutsch). Beachte die landestypischen Konventionen: ${lang.conventions}`;
      const today = new Date().toLocaleDateString(lang.locale, { day: "2-digit", month: "2-digit", year: "numeric" });
      setGenPhase(t("wizard.genCv"));
      // NOTE: AI prompts stay German on purpose — generated documents target the German job market.
      const cvRes = await generateMutation.mutateAsync({ data: {
        type: "cv",
        batchId,
        systemPrompt: `Du bist ein professioneller Bewerbungsexperte. Antworte NUR mit validem JSON — kein Markdown, kein Wrapper, keine Erklärungen.

Gib exakt dieses JSON-Schema zurück:
{
  "name": "Vorname Nachname",
  "title": "Berufsbezeichnung",
  "contact": "Straße Nr, PLZ Stadt · Telefon · E-Mail · ggf. LinkedIn",
  "profile": "3–5 Sätze Profiltext",
  "experience": [
    {"position":"","company":"","location":"","period":"MM/JJJJ – MM/JJJJ","bullets":["Tätigkeit 1","Tätigkeit 2"]}
  ],
  "education": [
    {"degree":"","institution":"","location":"","period":"MM/JJJJ – MM/JJJJ","note":""}
  ],
  "skills": ["Kenntnis1","Kenntnis2"],
  "languages": [{"name":"Sprache","level":"Niveau"}],
  "signature": "Ort, den TT.MM.JJJJ"
}

PFLICHTREGELN:
1. LÜCKENLOSIGKEIT: Jede Lücke > 6 Monate zwischen Einträgen als eigenen experience-Eintrag einfügen (z.B. "Berufliche Neuorientierung", "Familienphase", period: "01/2003 – 08/2023"). Lücken von Jahrzehnten → mehrere Einträge mit echten Jahreszahlen.
2. SCHULABSCHLUSS: Wenn kein Schulabschluss in den Daten → ersten education-Eintrag setzen: degree "Schulabschluss — Bitte ergänzen", period "Bitte ergänzen".
3. SKILLS: Mindestens 6 Einträge im skills-Array. Wenn keine Skills übergeben → aus Berufserfahrung und Stelle ableiten.
4. SPRACHEN: Mindestens 1 Eintrag. Wenn keine → Deutsch Muttersprache eintragen.
5. PROFIL: Immer 3–5 Sätze, konkret, keine KI-Floskeln.
6. BULLETS: Jede experience-Station hat 2–4 bullets mit konkreten Tätigkeiten/Erfolgen.
7. DATUM: signature-Feld EXAKT mit dem übergebenen Datum befüllen.
8. Schreibe wie ein Mensch: keine Phrasen wie "dynamisch", "leidenschaftlich", "stets bestrebt".
9. CHRONOLOGIE: Alle Einträge in education UND experience chronologisch AUFSTEIGEND sortieren (ältester Eintrag zuerst, neuester zuletzt). education beginnt IMMER mit dem Schulabschluss, danach Ausbildung/Studium.`,
        userPrompt: `Erstelle Lebenslauf-JSON (Sprache: ${lang.name}) für:\n${JSON.stringify(promptForm, null, 2)}\n\nOptimiert für: ${form.jobad.title || "allgemein"} bei ${form.jobad.company || "unbekannt"}.\nsignature-Feld: "${(form.personal as any).city || "Ort"}, den ${today}"\n${form.school?.type || form.school?.name ? `\nSchulabschluss des Bewerbers (MUSS als erster education-Eintrag erscheinen): ${[form.school.type, form.school.name && `an ${form.school.name}`, form.school.city, form.school.year].filter(Boolean).join(", ")}` : "\nKein Schulabschluss angegeben → ersten education-Eintrag als 'Schulabschluss — Bitte ergänzen' anlegen."}\nAlle Lücken > 6 Monate füllen. Mindestens 6 Skills.${langInstr}`,
      } });

      // Parse structured JSON and render with fixed professional template
      let cvContent: CVContent;
      try {
        const raw = cvRes.result.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim();
        cvContent = JSON.parse(raw) as CVContent;
      } catch {
        // Fallback: try to extract JSON from partial response
        const match = cvRes.result.match(/\{[\s\S]*\}/);
        if (match) { cvContent = JSON.parse(match[0]) as CVContent; }
        else { throw new Error("CV-Generierung fehlgeschlagen. Bitte erneut versuchen."); }
      }
      if (usePhoto && form.personal.photo) cvContent.photo = form.personal.photo;
      const cvHtml = renderCVContent(cvContent, form.template, form.customStyle, docLang);
      const ats = computeAtsScore(form, cvHtml);

      let letterText = "";
      let letterGenerationId = "";
      {
        const hasJobad = !!(form.jobad.title || form.jobad.description || form.jobad.company);
        setGenPhase(t("wizard.genLetter"));
        const letterRes = await generateMutation.mutateAsync({ data: {
          type: "letter",
          batchId,
          systemPrompt: `Du bist Experte für Bewerbungsanschreiben. Schreibe wie ein echter, gut ausgebildeter Mensch — nicht wie eine KI.

TON: ${tone === "formell"
  ? "FORMELL - klassisches Geschaeftsdeutsch, 'Sehr geehrte Damen und Herren', serioese Sprache, keine persoenlichen Anekdoten. Praezise, sachlich, professionell."
  : tone === "modern"
  ? "MODERN - klar, direkt, auf den Punkt. Kein unnoetiges Fuellwort. 'Guten Tag' als Anrede ist erlaubt. Aktive Sprache, kurze Saetze, kein Fachjargon ohne Grund. Wirkt kompetent ohne steif zu klingen."
  : "KREATIV - beginne mit einem persoenlichen, konkreten Einstieg (einer Beobachtung, einer kurzen Anekdote oder einem unerwarteten Gedanken zur Stelle/zum Unternehmen). Erzaehlerisch, individuell, mit Persoenlichkeit - aber immer noch professionell. Kein Klamauk."
}

REGELN FÜR ALLE TÖNE:
- Keine KI-Phrasen: kein „dynamisch", „leidenschaftlich", „stets", „zeitnah", „ich bin überzeugt, dass ich", „ich freue mich sehr".
- Keine Aufzählungen mit Gedankenstrichen im Fließtext.
- Aktive Sprache: „Ich entwickelte" statt „Es wurde entwickelt".
- Eröffnung NICHT mit „Hiermit bewerbe ich mich".

STRUKTUR (DIN 5008):
1. Empfängeradresse des Unternehmens (linke Seite)
2. Datum-Zeile
3. Betreffzeile (ohne „Betreff:")
4. Anrede
5. Einleitung: konkreter Bezug zur Stelle / zum Unternehmen
6. Hauptteil: Erfahrung + Mehrwert
7. Motivationsabsatz
8. Schluss: Gesprächseinladung, keine Floskeln
9. „Mit freundlichen Grüßen" + Name

Ausgabe: NUR der Bewerbung-Text, kein HTML, keine Erklärungen. 350–420 Wörter.`,
          userPrompt: `Schreibe Bewerbung (Sprache: ${lang.name}):

Bewerber: ${form.personal.firstName} ${form.personal.lastName}${form.personal.title ? ", " + form.personal.title : ""}
Adresse Bewerber: ${[form.personal.address, `${form.personal.zip} ${form.personal.city}`.trim()].filter(Boolean).join(", ")}
Stelle: ${hasJobad ? `${form.jobad.title || "Initiativbewerbung"} bei ${form.jobad.company || "dem Unternehmen"}` : `Initiativbewerbung als ${form.experience[0]?.position || form.personal.title || "Fachkraft"} (keine konkrete Stellenanzeige — schreibe ein überzeugendes Initiativ-Bewerbung passend zum Werdegang, Empfängeradresse generisch als "Personalabteilung" ohne erfundenen Firmennamen)`}${(form.jobad as any).address ? `\nUnternehmensadresse (MUSS als Empfängeradresse erscheinen): ${(form.jobad as any).address}` : ""}
Stellenbeschreibung: ${form.jobad.description || "nicht angegeben"}

Erfahrung (aktuellste zuerst):
${form.experience.slice(0, 4).map(e => `• ${e.position} bei ${e.company}${e.city ? ", " + e.city : ""}${e.start ? " (" + e.start.slice(0,7) + " – " + (e.current ? "heute" : (e.end?.slice(0,7)||"")) + ")" : ""}${e.description ? ": " + e.description.slice(0,120) : ""}`).join("\n")}

Kernkompetenzen: ${form.skills.slice(0, 10).map(s => s.name).join(", ") || "aus Erfahrung ableiten"}
${motivation ? `\nMotivation/Bezug zum Unternehmen (UNBEDINGT einbauen, WÖRTLICH verwenden): ${motivation}` : ""}
${achievement ? `\nBesonderer Erfolg (UNBEDINGT konkret nennen): ${achievement}` : ""}

Datum-Zeile EXAKT: "${(form.personal as any).city || "Ort"}, den ${today}"
Eröffnung NICHT mit „Hiermit bewerbe ich mich".${langInstr}`,
        } });
        letterText = letterRes.result;
        letterGenerationId = letterRes.generationId;
      }

      // Save the profile while the initial free application is still open.
      // From the completed document onwards, all free app actions are locked.
      try {
        await customFetch("/api/saved-profile", {
          method: "PUT",
          body: JSON.stringify({ savedProfile: { personal: form.personal, school: form.school, experience: form.experience, education: form.education, skills: form.skills, languages: form.languages } }),
        });
      } catch { /* ignore */ }

      setGenPhase(t("wizard.genSaving"));
      const created = await createMutation.mutateAsync({ data: {
        name: `${form.personal.firstName} ${form.personal.lastName}${form.jobad.title ? " – " + form.jobad.title : ""}`,
        template: form.template,
        profileData: { ...form, atsScore: ats, cv_json: cvContent, language: docLang } as unknown as Record<string, unknown>,
        cvHtml,
        coverLetter: letterText,
        generationBatchId: batchId,
        cvGenerationId: cvRes.generationId,
        letterGenerationId,
        jobTitle: form.jobad.title,
        jobCompany: form.jobad.company,
      } });

      toast({ title: t("wizard.success") });
      refetchProfile();
      // Open the exact document that was just saved. This avoids a race where
      // the profile refresh activates the free lock before the document list
      // has refreshed, and keeps the saved CV and letter visible read-only.
      const documentId = (created as any)?.id;
      navigate(documentId ? `/preview/${documentId}` : "/documents");
    } catch (e: any) {
      if (e?.data?.error === "free_limit_reached" || e?.message?.includes("free_limit_reached")) {
        navigate("/pricing");
      } else if (e?.data?.error === "premium_limit_reached" || e?.message?.includes("premium_limit_reached")) {
        toast({ title: t("wizard.premiumLimit"), variant: "destructive" });
        navigate("/pricing");
      } else {
        toast({ title: t("wizard.genError"), description: e.message || t("wizard.genErrorUnknown"), variant: "destructive" });
      }
    } finally {
      setGenerating(false);
      setGenPhase("");
    }
  }

  if (generating) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="text-5xl mb-5" style={{ animation: "spin 2s linear infinite" }}>✨</div>
          <h2 style={{ fontFamily: "var(--fd)", fontSize: 24 }} className="mb-3">{genPhase}</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>{t("wizard.genWorking")}</p>
          <div className="flex items-center gap-3 mt-6" style={{ color: "var(--muted)", fontSize: 14 }}>
            <span className="spin" /> {t("wizard.genPatience")}
          </div>
        </div>
      </Layout>
    );
  }

  const pct = ((step + 1) / STEPS.length * 100).toFixed(0);

  return (
    <Layout>
      <div className="fade">
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ fontFamily: "var(--fd)", fontSize: 22, fontWeight: 700 }}>
              {STEPS[step].icon} {t(`wizard.steps.${STEPS[step].id}`)}
            </h2>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{t("wizard.stepCount", { current: step + 1, total: STEPS.length })}</span>
          </div>
          <div className="prog"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
          <div className="step-line" style={{ marginTop: 10 }}>
            {STEPS.map((st, i) => (
              <div key={st.id} style={{ display: "flex", alignItems: "center" }}>
                <div
                  className={`sdot ${i === step ? "on" : i < step ? "done" : ""}`}
                  onClick={() => i < step && setStep(i)}
                  title={t(`wizard.steps.${st.id}`)}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={`scon ${i < step ? "done" : ""}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          {hasSavedProfile && step === 0 && (
            <div
              onClick={() => !profileLoading && loadProfile()}
              role="button"
              style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", cursor: "pointer" }}
            >
              <span style={{ fontSize: 14 }}>💾 {t("wizard.savedProfileAvailable")}</span>
              <button className="btn btn-s" onClick={(e) => { e.stopPropagation(); loadProfile(); }} disabled={profileLoading} style={{ flexShrink: 0, fontSize: 13 }}>
                {profileLoading ? "…" : t("wizard.loadProfile")}
              </button>
            </div>
          )}
          {step === 0 && <StepPersonal form={form} setPersonal={setPersonal} applyImport={(d) => setForm(f => ({ ...f, ...d, personal: { ...f.personal, ...(d.personal || {}) }, jobad: (d as any).jobad ? { ...f.jobad, ...(d as any).jobad } : f.jobad, template: f.template }))} user={user} authLoading={authLoading} setShowAuthModal={setShowAuthModal} />}
          {step === 1 && <StepSchool school={form.school} setSchool={setSchool} />}
          {step === 2 && <StepEducation items={form.education} addEdu={addEdu} updateEdu={updateEdu} delEdu={delEdu} />}
          {step === 3 && <StepExperience items={form.experience} addExp={addExp} updateExp={updateExp} delExp={delExp} />}
          {step === 4 && <StepSkills items={form.skills} skillInput={skillInput} setSkillInput={setSkillInput} skillLevel={skillLevel} setSkillLevel={setSkillLevel} addSkill={addSkill} delSkill={delSkill} />}
          {step === 5 && <StepLanguages items={form.languages} addLang={addLang} updateLang={updateLang} delLang={delLang} />}
          {step === 6 && <StepJobAd form={form} setJobad={setJobad} />}
          {step === 7 && <StepTemplate form={form} setTemplate={setTemplate} setCustomStyle={setCustomStyle} />}
          {step === 8 && <StepGenerate form={form} user={user} setShowAuthModal={setShowAuthModal} handleGenerate={handleGenerate} docLang={docLang} setDocLang={setDocLang} motivation={motivation} setMotivation={setMotivation} achievement={achievement} setAchievement={setAchievement} tone={tone} setTone={setTone} />}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button className="btn btn-s" onClick={() => setStep(s => s - 1)} disabled={step === 0}>{t("wizard.back")}</button>
          {step < STEPS.length - 1
            ? <button className="btn btn-p" onClick={() => setStep(s => s + 1)}>{t("wizard.next")}</button>
            : <button className="btn btn-p btn-lg" onClick={handleGenerate}>{t("wizard.generateBtn")}</button>
          }
        </div>
      </div>
    </Layout>
  );
}

function StepPersonal({ form, setPersonal, applyImport, user, authLoading, setShowAuthModal }: {
  form: FormData; setPersonal: (k: string, v: string) => void;
  applyImport: (d: Partial<FormData>) => void;
  user: any; authLoading: boolean; setShowAuthModal: (v: boolean) => void;
}) {
  const p = form.personal;
  const { t } = useTranslation();
  const { toast } = useToast();
  const [liOpen, setLiOpen] = useState(false);
  const [liText, setLiText] = useState("");
  const [liLoading, setLiLoading] = useState(false);
  const [ftOpen, setFtOpen] = useState(false);
  const [ftText, setFtText] = useState("");
  const [ftLoading, setFtLoading] = useState(false);
  const prefillHandled = useRef(false);

  // Prefill from Scanner ("use as template"): text stored in sessionStorage before navigation
  useEffect(() => {
    if (authLoading || prefillHandled.current) return;
    try {
      const pre = takeWizardPrefill(sessionStorage);
      if (pre) {
        prefillHandled.current = true;
        setFtText(pre);
        if (user) {
          setFtOpen(true);
          void importFreetext(pre);
        } else {
          setFtOpen(true);
        }
      }
    } catch { /* ignore */ }
  }, [authLoading, user]);

  async function importFreetext(textOverride?: string) {
    if (!user) { setShowAuthModal(true); return; }
    const textToImport = (textOverride ?? ftText).trim();
    if (textToImport.length < 30) return;
    setFtLoading(true);
    try {
      const res = await customFetch<{ data: Partial<FormData> }>("/api/parse-freetext", {
        method: "POST",
        body: JSON.stringify({ text: textToImport }),
      });
      applyImport(res.data);
      setFtOpen(false); setFtText("");
      toast({ title: t("wizard.freetext.success") });
    } catch {
      toast({ title: t("wizard.freetext.error"), variant: "destructive" });
    } finally { setFtLoading(false); }
  }

  function handlePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      toast({ title: t("wizard.linkedin.error"), variant: "destructive" });
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        // Resize to fit 300×400 (both dimensions bounded), JPEG — keeps base64 small
        const ratio = Math.min(1, 300 / img.width, 400 / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPersonal("photo", canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        toast({ title: t("wizard.linkedin.error"), variant: "destructive" });
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast({ title: t("wizard.linkedin.error"), variant: "destructive" });
    };
    img.src = url;
  }

  async function importLinkedIn() {
    if (!user) { setShowAuthModal(true); return; }
    if (liText.trim().length < 50) return;
    setLiLoading(true);
    try {
      const res = await customFetch<{ data: Partial<FormData> }>("/api/parse-linkedin", {
        method: "POST",
        body: JSON.stringify({ text: liText }),
      });
      applyImport(res.data);
      setLiOpen(false); setLiText("");
      toast({ title: t("wizard.linkedin.success") });
    } catch {
      toast({ title: t("wizard.linkedin.error"), variant: "destructive" });
    } finally { setLiLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Quick-fill: free text + LinkedIn import */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-s" style={{ fontSize: 13 }} onClick={() => { setFtOpen(o => !o); setLiOpen(false); }}>
          ⚡ {t("wizard.freetext.button")}
        </button>
        <button type="button" className="btn btn-s" style={{ fontSize: 13 }} onClick={() => { setLiOpen(o => !o); setFtOpen(false); }}>
          🔗 {t("wizard.linkedin.button")}
        </button>
      </div>
      {ftOpen && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--bg2)" }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>{t("wizard.freetext.hint")}</div>
          <div style={{ marginBottom: 10 }}>
            <FileImportButton onText={(txt) => setFtText(txt)} />
          </div>
          <textarea className="textarea" value={ftText} onChange={e => setFtText(e.target.value)} placeholder={t("wizard.freetext.placeholder")} style={{ minHeight: 170, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-p btn-sm" onClick={() => importFreetext()} disabled={ftLoading || ftText.trim().length < 30}>
              {ftLoading ? <><span className="spin" /> {t("wizard.freetext.importing")}</> : t("wizard.freetext.import")}
            </button>
            <button type="button" className="btn btn-g btn-sm" onClick={() => setFtOpen(false)}>{t("wizard.linkedin.cancel")}</button>
          </div>
        </div>
      )}
      {liOpen && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--bg2)" }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>{t("wizard.linkedin.hint")}</div>
          <textarea className="textarea" value={liText} onChange={e => setLiText(e.target.value)} placeholder={t("wizard.linkedin.placeholder")} style={{ minHeight: 130, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-p btn-sm" onClick={importLinkedIn} disabled={liLoading || liText.trim().length < 50}>
              {liLoading ? <><span className="spin" /> {t("wizard.linkedin.importing")}</> : t("wizard.linkedin.import")}
            </button>
            <button type="button" className="btn btn-g btn-sm" onClick={() => setLiOpen(false)}>{t("wizard.linkedin.cancel")}</button>
          </div>
        </div>
      )}

      {/* Photo upload */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {p.photo ? (
          <img src={p.photo} alt="" style={{ width: 64, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
        ) : (
          <div style={{ width: 64, height: 80, borderRadius: 6, border: "1.5px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--muted)" }}>📷</div>
        )}
        <div>
          <label className="btn btn-s btn-sm" style={{ cursor: "pointer", display: "inline-block" }}>
            {t("wizard.personal.photoUpload")}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handlePhoto(e.target.files?.[0])} />
          </label>
          {p.photo && (
            <button type="button" className="btn btn-g btn-sm" style={{ marginInlineStart: 8 }} onClick={() => setPersonal("photo", "")}>
              {t("wizard.personal.photoRemove")}
            </button>
          )}
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{t("wizard.personal.photoHint")}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="field"><label className="label">{t("wizard.personal.firstName")}</label><input className="input" value={p.firstName} onChange={e => setPersonal("firstName", e.target.value)} placeholder={t("wizard.personal.firstNamePh")} /></div>
        <div className="field"><label className="label">{t("wizard.personal.lastName")}</label><input className="input" value={p.lastName} onChange={e => setPersonal("lastName", e.target.value)} placeholder={t("wizard.personal.lastNamePh")} /></div>
      </div>
      <div className="field"><label className="label">{t("wizard.personal.jobTitle")}</label><input className="input" value={p.title} onChange={e => setPersonal("title", e.target.value)} placeholder={t("wizard.personal.jobTitlePh")} /></div>
      <div className="grid2">
        <div className="field"><label className="label">{t("wizard.personal.email")}</label><input className="input" type="email" value={p.email} onChange={e => setPersonal("email", e.target.value)} placeholder={t("wizard.personal.emailPh")} /></div>
        <div className="field"><label className="label">{t("wizard.personal.phone")}</label><input className="input" value={p.phone} onChange={e => setPersonal("phone", e.target.value)} placeholder={t("wizard.personal.phonePh")} /></div>
      </div>
      <div className="grid3">
        <div className="field"><label className="label">{t("wizard.personal.street")}</label><input className="input" value={p.address} onChange={e => setPersonal("address", e.target.value)} placeholder={t("wizard.personal.streetPh")} /></div>
        <div className="field"><label className="label">{t("wizard.personal.zip")}</label><input className="input" value={p.zip} onChange={e => setPersonal("zip", e.target.value)} placeholder={t("wizard.personal.zipPh")} /></div>
        <div className="field"><label className="label">{t("wizard.personal.city")}</label><input className="input" value={p.city} onChange={e => setPersonal("city", e.target.value)} placeholder={t("wizard.personal.cityPh")} /></div>
      </div>
      <div className="grid2">
        <div className="field"><label className="label">{t("wizard.personal.linkedin")}</label><input className="input" value={p.linkedin} onChange={e => setPersonal("linkedin", e.target.value)} placeholder={t("wizard.personal.linkedinPh")} /></div>
        <div className="field"><label className="label">{t("wizard.personal.website")}</label><input className="input" value={p.website} onChange={e => setPersonal("website", e.target.value)} placeholder={t("wizard.personal.websitePh")} /></div>
      </div>
      <div className="field"><label className="label">{t("wizard.personal.summary")}</label><textarea className="textarea" value={p.summary} onChange={e => setPersonal("summary", e.target.value)} placeholder={t("wizard.personal.summaryPh")} /></div>
    </div>
  );
}

// ── Nominatim place lookup ──────────────────────────────────────────────────
type NominatimResult = { display_name: string; address: Record<string, string> };

function PlaceLookup({ query, onSelect }: { query: string; onSelect: (city: string, fullAddress: string) => void }) {
  const { t } = useTranslation();
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function search() {
    if (!query.trim() || query.length < 3) return;
    setLoading(true); setOpen(true); setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&accept-language=de`,
        { headers: { "User-Agent": "BewerbungsKI/1.0 contact@bewerbungski.de" } }
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
    } catch { setResults([]); }
    setLoading(false);
  }

  function pick(r: NominatimResult) {
    const a = r.address;
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state || "";
    const road = a.road ? `${a.road}${a.house_number ? " " + a.house_number : ""}` : "";
    const postcode = a.postcode || "";
    const full = [road, `${postcode} ${city}`.trim()].filter(Boolean).join(", ");
    onSelect(city, full);
    setOpen(false); setResults([]);
  }

  return (
    <div style={{ position: "relative", display: "inline-block", marginTop: 5 }}>
      <button type="button" className="btn btn-s" style={{ fontSize: 12, padding: "4px 10px" }}
        onClick={search} disabled={!query || query.length < 3 || loading}>
        {loading ? "⏳" : "🔍"} {t("wizard.lookup.search")}
      </button>
      {open && (results.length > 0 || !loading) && (
        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 200, minWidth: 260, maxWidth: 360, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.15)", overflow: "hidden" }}>
          {results.length === 0 && <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>{t("wizard.lookup.noResults")}</div>}
          {results.map((r, idx) => (
            <div key={idx} style={{ padding: "12px 14px", cursor: "pointer", fontSize: 12, lineHeight: 1.45, borderBottom: idx < results.length - 1 ? "1px solid var(--border)" : "none", WebkitTapHighlightColor: "rgba(37,99,235,.15)", userSelect: "none" }}
              onClick={() => pick(r)}
              onTouchEnd={e => { e.preventDefault(); pick(r); }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-light,#eff6ff)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              {r.display_name}
            </div>
          ))}
          <div style={{ padding: "5px 14px", fontSize: 10, color: "var(--muted)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <span>© OpenStreetMap</span>
            <span style={{ cursor: "pointer" }} onClick={() => setOpen(false)}>✕ {t("wizard.lookup.close")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────

function StepExperience({ items, addExp, updateExp, delExp }: { items: Experience[]; addExp: () => void; updateExp: (i: number, k: string, v: string | boolean) => void; delExp: (i: number) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "var(--accent-light, #eff6ff)", border: "1px solid var(--accent-border, #bfdbfe)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "var(--accent-text, #1d4ed8)", lineHeight: 1.55 }}>{t("wizard.exp.hint")}</div>
      {items.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: 14 }}>{t("wizard.exp.empty")}</div>}
      {items.map((e, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 18, position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 12 }}>{t("wizard.exp.item", { num: i + 1 })}</div>
          <button className="btn btn-d btn-sm" style={{ position: "absolute", top: 12, insetInlineEnd: 12 }} onClick={() => delExp(i)}>×</button>
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field">
              <label className="label">{t("wizard.exp.company")}</label>
              <input className="input" value={e.company} onChange={ev => updateExp(i, "company", ev.target.value)} placeholder={t("wizard.exp.companyPh")} />
              <PlaceLookup query={e.company} onSelect={(city) => updateExp(i, "city", city)} />
            </div>
            <div className="field">
              <label className="label">{t("wizard.exp.city")}</label>
              <input className="input" value={e.city || ""} onChange={ev => updateExp(i, "city", ev.target.value)} placeholder={t("wizard.exp.cityPh")} />
            </div>
          </div>
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field"><label className="label">{t("wizard.exp.position")}</label><input className="input" value={e.position} onChange={ev => updateExp(i, "position", ev.target.value)} placeholder={t("wizard.exp.positionPh")} /></div>
          </div>
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field"><label className="label">{t("wizard.exp.from")}</label><input className="input" type="month" value={e.start} onChange={ev => updateExp(i, "start", ev.target.value)} /></div>
            <div className="field">
              <label className="label">{t("wizard.exp.to")}</label>
              <input className="input" type="month" value={e.end} onChange={ev => updateExp(i, "end", ev.target.value)} disabled={e.current} />
              <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
                <input type="checkbox" checked={e.current} onChange={ev => updateExp(i, "current", ev.target.checked)} /> {t("wizard.exp.current")}
              </label>
            </div>
          </div>
          <div className="field"><label className="label">{t("wizard.exp.tasks")}</label><textarea className="textarea" value={e.description} onChange={ev => updateExp(i, "description", ev.target.value)} placeholder={t("wizard.exp.tasksPh")} style={{ minHeight: 70 }} /></div>
        </div>
      ))}
      <button className="btn btn-s" style={{ alignSelf: "flex-start" }} onClick={addExp}>{t("wizard.exp.add")}</button>
    </div>
  );
}

function StepSchool({ school, setSchool }: {
  school: import("../lib/buildCVHTML").School;
  setSchool: (k: string, v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", background: "var(--bg3)", borderRadius: 8, padding: "10px 14px" }}>
        🏫 {t("wizard.school.hint")}
      </div>
      <div className="grid2" style={{ gap: 10 }}>
        <div className="field">
          <label className="label">{t("wizard.school.type")}</label>
          <input className="input" value={school.type} onChange={ev => setSchool("type", ev.target.value)} placeholder={t("wizard.school.typePh")} list="school-types" />
          <datalist id="school-types">
            {["Abitur", "Fachabitur", "Realschulabschluss", "Mittlere Reife", "Hauptschulabschluss", "Berufsschule", "High School Diploma", "Baccalauréat"].map(o => <option key={o} value={o} />)}
          </datalist>
        </div>
        <div className="field">
          <label className="label">{t("wizard.school.year")}</label>
          <input className="input" value={school.year} onChange={ev => setSchool("year", ev.target.value)} placeholder={t("wizard.school.yearPh")} maxLength={4} inputMode="numeric" />
        </div>
      </div>
      <div className="grid2" style={{ gap: 10 }}>
        <div className="field">
          <label className="label">{t("wizard.school.name")}</label>
          <input className="input" value={school.name} onChange={ev => setSchool("name", ev.target.value)} placeholder={t("wizard.school.namePh")} />
        </div>
        <div className="field">
          <label className="label">{t("wizard.school.city")}</label>
          <input className="input" value={school.city} onChange={ev => setSchool("city", ev.target.value)} placeholder={t("wizard.school.cityPh")} />
        </div>
      </div>
    </div>
  );
}

function StepEducation({ items, addEdu, updateEdu, delEdu }: {
  items: Education[]; addEdu: () => void; updateEdu: (i: number, k: string, v: string) => void; delEdu: (i: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", background: "var(--bg3)", borderRadius: 8, padding: "10px 14px" }}>
        {t("wizard.edu.hint")}
      </div>
      {items.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: 14 }}>{t("wizard.edu.empty")}</div>}
      {items.map((e, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 18, position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 12 }}>{t("wizard.edu.item", { num: i + 1 })}</div>
          <button className="btn btn-d btn-sm" style={{ position: "absolute", top: 12, insetInlineEnd: 12 }} onClick={() => delEdu(i)}>×</button>
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field">
              <label className="label">{t("wizard.edu.school")}</label>
              <input className="input" value={e.institution} onChange={ev => updateEdu(i, "institution", ev.target.value)} placeholder={t("wizard.edu.schoolPh")} />
              <PlaceLookup query={e.institution} onSelect={(city) => updateEdu(i, "city", city)} />
            </div>
            <div className="field">
              <label className="label">{t("wizard.edu.city")}</label>
              <input className="input" value={e.city || ""} onChange={ev => updateEdu(i, "city", ev.target.value)} placeholder={t("wizard.edu.cityPh")} />
            </div>
          </div>
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field"><label className="label">{t("wizard.edu.degree")}</label><input className="input" value={e.degree} onChange={ev => updateEdu(i, "degree", ev.target.value)} placeholder={t("wizard.edu.degreePh")} /></div>
            <div className="field"><label className="label">{t("wizard.edu.field")}</label><input className="input" value={e.field} onChange={ev => updateEdu(i, "field", ev.target.value)} placeholder={t("wizard.edu.fieldPh")} /></div>
          </div>
          <div className="grid2" style={{ gap: 10 }}>
            <div className="field"><label className="label">{t("wizard.edu.from")}</label><input className="input" type="month" value={e.start} onChange={ev => updateEdu(i, "start", ev.target.value)} /></div>
            <div className="field"><label className="label">{t("wizard.edu.to")}</label><input className="input" type="month" value={e.end} onChange={ev => updateEdu(i, "end", ev.target.value)} /></div>
          </div>
        </div>
      ))}
      <button className="btn btn-s" style={{ alignSelf: "flex-start" }} onClick={addEdu}>{t("wizard.edu.add")}</button>
    </div>
  );
}

const LVL_VALS = [20, 40, 60, 80, 100];

function StepSkills({ items, skillInput, setSkillInput, skillLevel, setSkillLevel, addSkill, delSkill }: {
  items: Skill[]; skillInput: string; setSkillInput: (v: string) => void;
  skillLevel: number; setSkillLevel: (v: number) => void;
  addSkill: () => void; delSkill: (i: number) => void;
}) {
  const { t } = useTranslation();
  const lvlLabels = [t("wizard.skills.lvl1"), t("wizard.skills.lvl2"), t("wizard.skills.lvl3"), t("wizard.skills.lvl4"), t("wizard.skills.lvl5")];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "1 1 160px", minWidth: 0 }}>
          <label className="label">{t("wizard.skills.skill")}</label>
          <input className="input" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addSkill()} placeholder={t("wizard.skills.skillPh")} />
        </div>
        <div className="field" style={{ flex: "0 1 150px", minWidth: 110 }}>
          <label className="label">{t("wizard.skills.level")}</label>
          <select className="select" value={skillLevel} onChange={e => setSkillLevel(Number(e.target.value))}>
            {LVL_VALS.map((v, i) => <option key={v} value={v}>{lvlLabels[i]}</option>)}
          </select>
        </div>
        <button className="btn btn-p btn-sm" onClick={addSkill} style={{ marginBottom: 0, flexShrink: 0 }}>{t("wizard.skills.add")}</button>
      </div>
      {items.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0", fontSize: 14 }}>{t("wizard.skills.empty")}</div>}
      {items.map((sk, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{sk.name}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{lvlLabels[LVL_VALS.indexOf(sk.level)] || sk.level + "%"}</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${sk.level}%`, height: "100%", background: "linear-gradient(90deg,var(--brand),var(--accent))", borderRadius: 3 }} />
            </div>
          </div>
          <button className="btn btn-g btn-sm" onClick={() => delSkill(i)} style={{ color: "var(--err)" }}>×</button>
        </div>
      ))}
    </div>
  );
}

function StepLanguages({ items, addLang, updateLang, delLang }: { items: Language[]; addLang: () => void; updateLang: (i: number, k: string, v: string) => void; delLang: (i: number) => void }) {
  const { t } = useTranslation();
  // CEFR codes are universal; "Muttersprache" stays the stored value for the native level but is displayed translated.
  const langLevels = ["A1", "A2", "B1", "B2", "C1", "C2", "Muttersprache"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0", fontSize: 14 }}>{t("wizard.langs.empty")}</div>}
      {items.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 140px", minWidth: 0 }}><label className="label">{t("wizard.langs.language")}</label><input className="input" value={l.language} onChange={e => updateLang(i, "language", e.target.value)} placeholder={t("wizard.langs.languagePh")} /></div>
          <div className="field" style={{ flex: "0 1 160px", minWidth: 110 }}>
            <label className="label">{t("wizard.langs.level")}</label>
            <select className="select" value={l.level} onChange={e => updateLang(i, "level", e.target.value)}>
              {langLevels.map(lv => <option key={lv} value={lv}>{lv === "Muttersprache" ? t("wizard.langs.native") : lv}</option>)}
            </select>
          </div>
          <button className="btn btn-d btn-sm" style={{ marginBottom: 0 }} onClick={() => delLang(i)}>×</button>
        </div>
      ))}
      <button className="btn btn-s" style={{ alignSelf: "flex-start" }} onClick={addLang}>{t("wizard.langs.add")}</button>
    </div>
  );
}

function StepJobAd({ form, setJobad }: { form: FormData; setJobad: (k: string, v: string) => void }) {
  const j = form.jobad;
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "var(--brand-l)", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12, fontSize: 13, color: "var(--brand)", display: "flex", gap: 10 }}>
        <span>ℹ️</span><span>{t("wizard.jobad.info")}</span>
      </div>
      <div className="grid2">
        <div className="field"><label className="label">{t("wizard.jobad.position")}</label><input className="input" value={j.title} onChange={e => setJobad("title", e.target.value)} placeholder={t("wizard.jobad.positionPh")} /></div>
        <div className="field">
          <label className="label">{t("wizard.jobad.company")}</label>
          <input className="input" value={j.company} onChange={e => setJobad("company", e.target.value)} placeholder={t("wizard.jobad.companyPh")} />
          <PlaceLookup query={j.company} onSelect={(_city, full) => setJobad("address", full)} />
        </div>
      </div>
      <div className="field">
        <label className="label">{t("wizard.jobad.address")}</label>
        <input className="input" value={(j as any).address || ""} onChange={e => setJobad("address", e.target.value)} placeholder={t("wizard.jobad.addressPh")} />
      </div>
      <div className="field"><label className="label">{t("wizard.jobad.description")}</label><textarea className="textarea" value={j.description} onChange={e => setJobad("description", e.target.value)} placeholder={t("wizard.jobad.descriptionPh")} style={{ minHeight: 160 }} /></div>
    </div>
  );
}

const TEMPLATES = [
  { id: "blobs" as const,         name: "Blobs",      descKey: "wizard.template.blobsDesc" },
  { id: "welle" as const,         name: "Welle",      descKey: "wizard.template.welleDesc" },
  { id: "halo" as const,          name: "Halo",       descKey: "wizard.template.haloDesc" },
  { id: "splitblock" as const,    name: "Block",      descKey: "wizard.template.splitblockDesc" },
  { id: "klammern" as const,      name: "Frame",      descKey: "wizard.template.klammernDesc" },
  { id: "winkel" as const,        name: "Chevron",    descKey: "wizard.template.winkelDesc" },
  { id: "bogen" as const,         name: "Arc",        descKey: "wizard.template.bogenDesc" },
  { id: "zweig" as const,         name: "Botanic",    descKey: "wizard.template.zweigDesc" },
  { id: "berge" as const,         name: "Horizon",    descKey: "wizard.template.bergeDesc" },
  { id: "konfetti" as const,      name: "Konfetti",   descKey: "wizard.template.konfettiDesc" },
  { id: "wellenband" as const,    name: "Candy",      descKey: "wizard.template.wellenbandDesc" },
  { id: "farbkreis" as const,     name: "Citrus",     descKey: "wizard.template.farbkreisDesc" },
  { id: "blobcorner" as const,    name: "Nova",       descKey: "wizard.template.blobcornerDesc" },
  { id: "aurora" as const,        name: "Aurora",     descKey: "wizard.template.auroraDesc" },
  { id: "prisma" as const,        name: "Prisma",     descKey: "wizard.template.prismaDesc" },
  { id: "verlaufswelle" as const, name: "Flow",       descKey: "wizard.template.verlaufswelleDesc" },
  { id: "blaupause" as const,     name: "Blueprint",  descKey: "wizard.template.blaupauseDesc" },
  { id: "technik" as const,       name: "Graphit",    descKey: "wizard.template.technikDesc" },
  { id: "raster" as const,        name: "Raster",     descKey: "wizard.template.rasterDesc" },
];

function StepTemplate({ form, setTemplate, setCustomStyle }: { form: FormData; setTemplate: (t: TemplateId) => void; setCustomStyle: (cs: NonNullable<FormData["customStyle"]>) => void }) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [designBusy, setDesignBusy] = useState(false);
  const [designErr, setDesignErr] = useState("");
  const customSelected = form.template === "custom" && !!form.customStyle;

  async function handleDesignFile(file: File) {
    setDesignErr("");
    file = await compressImageIfNeeded(file, 15 * 1024 * 1024);
    if (file.size > 15 * 1024 * 1024) { setDesignErr(t("fileImport.tooLarge")); return; }
    setDesignBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      const res: any = await customFetch("/api/design", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType, data: btoa(bin) }),
      });
      if (res?.accent) setCustomStyle(res);
      else setDesignErr(t("wizard.template.customError"));
    } catch (e: any) {
      const msg = String(e?.message || "");
      setDesignErr(msg.includes("429") ? t("fileImport.limit") : t("wizard.template.customError"));
    } finally {
      setDesignBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>{t("wizard.template.choose")}</p>

      <div style={{
        border: `2px ${customSelected ? "solid var(--brand)" : "dashed var(--border)"}`,
        borderRadius: 12, padding: 16, marginBottom: 18,
        background: customSelected ? "var(--brand-l)" : "var(--bg2)",
      }}>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDesignFile(f); }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ minWidth: 200, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>🎨 {t("wizard.template.customTitle")}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{t("wizard.template.customDesc")}</div>
            {customSelected && form.customStyle && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                {[form.customStyle.accent, form.customStyle.headerBg !== "transparent" ? form.customStyle.headerBg : form.customStyle.subColor, form.customStyle.chipBg].map((c, i) => (
                  <span key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: "1px solid var(--border)", display: "inline-block" }} />
                ))}
                <span style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 700 }}>✓ {t("wizard.template.customReady")}</span>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-g btn-sm" disabled={designBusy} onClick={() => fileRef.current?.click()}>
            {designBusy ? <><span className="spin" /> {t("wizard.template.customAnalyzing")}</> : t("wizard.template.customUpload")}
          </button>
        </div>
        {designErr && <div style={{ color: "var(--err)", fontSize: 12.5, marginTop: 8 }}>{designErr}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
        {TEMPLATES.map(tp => {
          const selected = form.template === tp.id;
          return (
            <div key={tp.id} onClick={() => setTemplate(tp.id)} style={{
              border: `2px solid ${selected ? "var(--brand)" : "var(--border)"}`,
              borderRadius: 12, padding: 10, cursor: "pointer",
              background: selected ? "var(--brand-l)" : "var(--bg2)",
              transition: "all .15s",
            }}>
              <div style={{
                background: "#f8fafc", borderRadius: 6, overflow: "hidden",
                marginBottom: 8, border: "1px solid #e5e7eb",
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}>
                <img src={letterheadUrl(tp.id)} alt={tp.name} loading="lazy"
                  style={{ display: "block", width: "100%", aspectRatio: "210/297", objectFit: "cover" }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{tp.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{t(tp.descKey)}</div>
              {selected && <div style={{ marginTop: 6, fontSize: 11, color: "var(--brand)", fontWeight: 700 }}>✓ {t("wizard.template.selected")}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepGenerate({ form, user, setShowAuthModal, handleGenerate, docLang, setDocLang, motivation, setMotivation, achievement, setAchievement, tone, setTone }: {
  form: FormData; user: any; setShowAuthModal: (v: boolean) => void; handleGenerate: () => void;
  docLang: string; setDocLang: (v: string) => void;
  motivation: string; setMotivation: (v: string) => void;
  achievement: string; setAchievement: (v: string) => void;
  tone: "formell" | "modern" | "kreativ"; setTone: (v: "formell" | "modern" | "kreativ") => void;
}) {
  const hasName = !!form.personal.firstName;
  const { t } = useTranslation();
  const templateName = form.template.charAt(0).toUpperCase() + form.template.slice(1);
  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✨</div>
        <h3 style={{ fontFamily: "var(--fd)", fontSize: 22, marginBottom: 10 }}>{t("wizard.gen.ready")}</h3>
        <p style={{ color: "var(--muted)", maxWidth: 400, margin: "0 auto", fontSize: 14, lineHeight: 1.6 }}>
          {t("wizard.gen.readyText", { letter: form.jobad.title ? t("wizard.gen.readyLetter") : "" })}
        </p>
      </div>

      {/* Tone selector */}
      {form.jobad.title && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t("wizard.gen.toneLabel")}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            {(["formell", "modern", "kreativ"] as const).map(v => (
              <div key={v} onClick={() => setTone(v)} style={{
                flex: 1, minWidth: 100, border: `2px solid ${tone === v ? "var(--brand)" : "var(--border)"}`,
                borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                background: tone === v ? "var(--brand-l)" : "var(--bg3)",
                transition: "all .15s",
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: tone === v ? "var(--brand)" : "var(--text)", marginBottom: 2 }}>
                  {t(`wizard.gen.tone${v.charAt(0).toUpperCase() + v.slice(1)}`)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                  {t(`wizard.gen.tone${v.charAt(0).toUpperCase() + v.slice(1)}Desc`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional boost questions */}
      {form.jobad.title && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t("wizard.gen.boostTitle")}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>{t("wizard.gen.boostHint")}</div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="label">{t("wizard.gen.motivationLabel")}</label>
            <textarea className="textarea" value={motivation} onChange={e => setMotivation(e.target.value)} placeholder={t("wizard.gen.motivationPh")} style={{ minHeight: 72 }} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">{t("wizard.gen.achievementLabel")}</label>
            <textarea className="textarea" value={achievement} onChange={e => setAchievement(e.target.value)} placeholder={t("wizard.gen.achievementPh")} style={{ minHeight: 72 }} />
          </div>
        </div>
      )}

      <div className="field" style={{ maxWidth: 320, margin: "0 auto 20px" }}>
        <label className="label">{t("wizard.gen.docLang")}</label>
        <select className="select" value={docLang} onChange={e => setDocLang(e.target.value)}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
          <option value="tr">Türkçe</option>
          <option value="ar">العربية</option>
          <option value="es">Español</option>
          <option value="pl">Polski</option>
          <option value="ru">Русский</option>
          <option value="uk">Українська</option>
        </select>
      </div>

      {!hasName && <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "#92400e" }}>{t("wizard.gen.fillFirst")}</div>}
      {!user && <div style={{ background: "var(--brand-l)", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "var(--brand)" }}>{t("wizard.gen.loginFirst")}</div>}

      <div style={{ textAlign: "center" }}>
        <button className="btn btn-p btn-lg" onClick={handleGenerate} disabled={!hasName}>{t("wizard.gen.generateNow")}</button>
        <div style={{ marginTop: 16 }}>
          {[t("wizard.gen.check1"), t("wizard.gen.check2"),
            t("wizard.gen.checkTemplate", { name: templateName }),
            t("wizard.gen.check4")
          ].map(f => <div key={f} style={{ fontSize: 13, color: "var(--muted)", marginBottom: 3 }}>✓ {f}</div>)}
        </div>
      </div>
    </div>
  );
}
