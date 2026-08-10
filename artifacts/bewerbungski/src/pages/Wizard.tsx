import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useGenerateDocument, useCreateDocument } from "@workspace/api-client-react";
import type { FormData, Experience, Education, Skill, Language } from "../lib/buildCVHTML";

const STEPS = [
  { id: "personal", icon: "👤" },
  { id: "experience", icon: "💼" },
  { id: "education", icon: "🎓" },
  { id: "skills", icon: "⚡" },
  { id: "languages", icon: "🌍" },
  { id: "jobad", icon: "📋" },
  { id: "template", icon: "🎨" },
  { id: "generate", icon: "✨" },
];

function blankForm(): FormData {
  return {
    personal: { firstName: "", lastName: "", title: "", email: "", phone: "", address: "", zip: "", city: "", linkedin: "", website: "", summary: "" },
    experience: [],
    education: [],
    skills: [],
    languages: [],
    jobad: { title: "", company: "", description: "" },
    template: "modern",
  };
}

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(blankForm());
  const [generating, setGenerating] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const [genPhase, setGenPhase] = useState("");
  const { user, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const generateMutation = useGenerateDocument();
  const createMutation = useCreateDocument();

  function setPersonal(key: string, value: string) {
    setForm(f => ({ ...f, personal: { ...f.personal, [key]: value } }));
  }
  function setJobad(key: string, value: string) {
    setForm(f => ({ ...f, jobad: { ...f.jobad, [key]: value } }));
  }
  function setTemplate(t: "modern" | "classic" | "creative") {
    setForm(f => ({ ...f, template: t }));
  }

  function addExp() {
    setForm(f => ({ ...f, experience: [...f.experience, { company: "", position: "", start: "", end: "", current: false, description: "" }] }));
  }
  function updateExp(i: number, key: string, value: string | boolean) {
    setForm(f => { const e = [...f.experience]; e[i] = { ...e[i], [key]: value }; return { ...f, experience: e }; });
  }
  function delExp(i: number) {
    setForm(f => ({ ...f, experience: f.experience.filter((_, idx) => idx !== i) }));
  }

  function addEdu() {
    setForm(f => ({ ...f, education: [...f.education, { institution: "", degree: "", field: "", grade: "", start: "", end: "" }] }));
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
      setGenPhase(t("wizard.genCv"));
      // NOTE: AI prompts stay German on purpose — generated documents target the German job market.
      const cvRes = await generateMutation.mutateAsync({ data: {
        type: "cv",
        systemPrompt: "Du bist ein professioneller Bewerbungsexperte für den deutschsprachigen Markt. Antworte nur mit HTML-Inhalt, kein Wrapper.",
        userPrompt: `Erstelle professionellen deutschen Lebenslauf-Inhalt als HTML für:\n${JSON.stringify(form, null, 2)}\n\nOptimiert für: ${form.jobad.title || "allgemein"} bei ${form.jobad.company || "unbekannt"}. Sektionen: Profil, Berufserfahrung, Ausbildung, Kenntnisse, Sprachen.`,
      } });

      let letterText = "";
      if (form.jobad.title || form.jobad.description) {
        setGenPhase(t("wizard.genLetter"));
        const letterRes = await generateMutation.mutateAsync({ data: {
          type: "letter",
          systemPrompt: "Du bist Experte für deutsche Bewerbungsunterlagen. Schreibe nur den Anschreiben-Text ohne HTML.",
          userPrompt: `Schreibe professionelles deutsches Anschreiben:\nBewerber: ${form.personal.firstName} ${form.personal.lastName}, ${form.personal.title || ""}\nStelle: ${form.jobad.title} bei ${form.jobad.company}\nStellenbeschreibung: ${form.jobad.description || "nicht angegeben"}\nErfahrung: ${form.experience.slice(0, 3).map(e => `${e.position} bei ${e.company}`).join("; ")}\nSkills: ${form.skills.slice(0, 8).map(s => s.name).join(", ")}\n\n350-400 Wörter, formell, überzeugend, keine Platzhalter.`,
        } });
        letterText = letterRes.result;
      }

      setGenPhase(t("wizard.genSaving"));
      await createMutation.mutateAsync({ data: {
        name: `${form.personal.firstName} ${form.personal.lastName}${form.jobad.title ? " – " + form.jobad.title : ""}`,
        template: form.template,
        profileData: form as unknown as Record<string, unknown>,
        cvHtml: cvRes.result,
        coverLetter: letterText,
        jobTitle: form.jobad.title,
        jobCompany: form.jobad.company,
      } });

      toast({ title: t("wizard.success") });
      navigate("/documents");
    } catch (e: any) {
      if (e?.data?.error === "free_limit_reached" || e?.message?.includes("free_limit_reached")) {
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
          {step === 0 && <StepPersonal form={form} setPersonal={setPersonal} />}
          {step === 1 && <StepExperience items={form.experience} addExp={addExp} updateExp={updateExp} delExp={delExp} />}
          {step === 2 && <StepEducation items={form.education} addEdu={addEdu} updateEdu={updateEdu} delEdu={delEdu} />}
          {step === 3 && <StepSkills items={form.skills} skillInput={skillInput} setSkillInput={setSkillInput} skillLevel={skillLevel} setSkillLevel={setSkillLevel} addSkill={addSkill} delSkill={delSkill} />}
          {step === 4 && <StepLanguages items={form.languages} addLang={addLang} updateLang={updateLang} delLang={delLang} />}
          {step === 5 && <StepJobAd form={form} setJobad={setJobad} />}
          {step === 6 && <StepTemplate form={form} setTemplate={setTemplate} />}
          {step === 7 && <StepGenerate form={form} user={user} setShowAuthModal={setShowAuthModal} handleGenerate={handleGenerate} />}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
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

function StepPersonal({ form, setPersonal }: { form: FormData; setPersonal: (k: string, v: string) => void }) {
  const p = form.personal;
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

function StepExperience({ items, addExp, updateExp, delExp }: { items: Experience[]; addExp: () => void; updateExp: (i: number, k: string, v: string | boolean) => void; delExp: (i: number) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: 14 }}>{t("wizard.exp.empty")}</div>}
      {items.map((e, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 18, position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 12 }}>{t("wizard.exp.item", { num: i + 1 })}</div>
          <button className="btn btn-d btn-sm" style={{ position: "absolute", top: 12, insetInlineEnd: 12 }} onClick={() => delExp(i)}>×</button>
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field"><label className="label">{t("wizard.exp.company")}</label><input className="input" value={e.company} onChange={ev => updateExp(i, "company", ev.target.value)} placeholder={t("wizard.exp.companyPh")} /></div>
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

function StepEducation({ items, addEdu, updateEdu, delEdu }: { items: Education[]; addEdu: () => void; updateEdu: (i: number, k: string, v: string) => void; delEdu: (i: number) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: 14 }}>{t("wizard.edu.empty")}</div>}
      {items.map((e, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 18, position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 12 }}>{t("wizard.edu.item", { num: i + 1 })}</div>
          <button className="btn btn-d btn-sm" style={{ position: "absolute", top: 12, insetInlineEnd: 12 }} onClick={() => delEdu(i)}>×</button>
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field"><label className="label">{t("wizard.edu.school")}</label><input className="input" value={e.institution} onChange={ev => updateEdu(i, "institution", ev.target.value)} placeholder={t("wizard.edu.schoolPh")} /></div>
            <div className="field"><label className="label">{t("wizard.edu.degree")}</label><input className="input" value={e.degree} onChange={ev => updateEdu(i, "degree", ev.target.value)} placeholder={t("wizard.edu.degreePh")} /></div>
          </div>
          <div className="grid2" style={{ gap: 10, marginBottom: 10 }}>
            <div className="field"><label className="label">{t("wizard.edu.field")}</label><input className="input" value={e.field} onChange={ev => updateEdu(i, "field", ev.target.value)} placeholder={t("wizard.edu.fieldPh")} /></div>
            <div className="field"><label className="label">{t("wizard.edu.grade")}</label><input className="input" value={e.grade} onChange={ev => updateEdu(i, "grade", ev.target.value)} placeholder={t("wizard.edu.gradePh")} /></div>
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
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="label">{t("wizard.skills.skill")}</label>
          <input className="input" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addSkill()} placeholder={t("wizard.skills.skillPh")} />
        </div>
        <div className="field" style={{ width: 150 }}>
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
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1 }}><label className="label">{t("wizard.langs.language")}</label><input className="input" value={l.language} onChange={e => updateLang(i, "language", e.target.value)} placeholder={t("wizard.langs.languagePh")} /></div>
          <div className="field" style={{ width: 160 }}>
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
        <div className="field"><label className="label">{t("wizard.jobad.company")}</label><input className="input" value={j.company} onChange={e => setJobad("company", e.target.value)} placeholder={t("wizard.jobad.companyPh")} /></div>
      </div>
      <div className="field"><label className="label">{t("wizard.jobad.description")}</label><textarea className="textarea" value={j.description} onChange={e => setJobad("description", e.target.value)} placeholder={t("wizard.jobad.descriptionPh")} style={{ minHeight: 160 }} /></div>
    </div>
  );
}

const TEMPLATES = [
  { id: "modern" as const, name: "Modern", descKey: "wizard.template.modernDesc", e: "🔵" },
  { id: "classic" as const, name: "Classic", descKey: "wizard.template.classicDesc", e: "⚫" },
  { id: "creative" as const, name: "Creative", descKey: "wizard.template.creativeDesc", e: "🎨" },
];

function StepTemplate({ form, setTemplate }: { form: FormData; setTemplate: (t: "modern" | "classic" | "creative") => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>{t("wizard.template.choose")}</p>
      <div className="grid3">
        {TEMPLATES.map(tp => (
          <div key={tp.id} onClick={() => setTemplate(tp.id)} style={{
            border: `2px solid ${form.template === tp.id ? "var(--brand)" : "var(--border)"}`,
            borderRadius: 14, padding: 20, cursor: "pointer",
            background: form.template === tp.id ? "var(--brand-l)" : "var(--bg2)",
            transition: "all .15s", textAlign: "center"
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{tp.e}</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{tp.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{t(tp.descKey)}</div>
            {form.template === tp.id && <span className="tag" style={{ marginTop: 10 }}>{t("wizard.template.selected")}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepGenerate({ form, user, setShowAuthModal, handleGenerate }: {
  form: FormData; user: any; setShowAuthModal: (v: boolean) => void; handleGenerate: () => void;
}) {
  const hasName = !!form.personal.firstName;
  const { t } = useTranslation();
  const templateName = form.template === "modern" ? "Modern" : form.template === "classic" ? "Classic" : "Creative";
  return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>✨</div>
      <h3 style={{ fontFamily: "var(--fd)", fontSize: 22, marginBottom: 10 }}>{t("wizard.gen.ready")}</h3>
      <p style={{ color: "var(--muted)", maxWidth: 400, margin: "0 auto 24px", fontSize: 14, lineHeight: 1.6 }}>
        {t("wizard.gen.readyText", { letter: form.jobad.title ? t("wizard.gen.readyLetter") : "" })}
      </p>
      {!hasName && <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "#92400e" }}>{t("wizard.gen.fillFirst")}</div>}
      {!user && <div style={{ background: "var(--brand-l)", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "var(--brand)" }}>{t("wizard.gen.loginFirst")}</div>}
      <button className="btn btn-p btn-lg" onClick={handleGenerate} disabled={!hasName}>{t("wizard.gen.generateNow")}</button>
      <div style={{ marginTop: 16 }}>
        {[t("wizard.gen.check1"), t("wizard.gen.check2"),
          t("wizard.gen.checkTemplate", { name: templateName }),
          t("wizard.gen.check4")
        ].map(f => <div key={f} style={{ fontSize: 13, color: "var(--muted)", marginBottom: 3 }}>✓ {f}</div>)}
      </div>
    </div>
  );
}
