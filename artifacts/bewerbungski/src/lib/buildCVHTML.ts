export type PersonalData = {
  firstName: string; lastName: string; title: string; email: string; phone: string;
  address: string; zip: string; city: string; linkedin: string; website: string;
  summary: string; photo?: string;
};
export type Experience = { company: string; city: string; position: string; start: string; end: string; current: boolean; description: string; };
export type Education = { institution: string; city: string; degree: string; field: string; grade: string; start: string; end: string; };
export type Skill = { name: string; level: number; };
export type Language = { language: string; level: string; };
export type TemplateId = "modern" | "classic" | "creative" | "executive" | "minimal" | "elegant" | "bold" | "compact" | "swiss" | "nordic" | "corporate" | "timeline" | "slate" | "terra";
export type School = { type: string; name: string; city: string; year: string; };
export type FormData = {
  personal: PersonalData; school: School; experience: Experience[]; education: Education[];
  skills: Skill[]; languages: Language[];
  jobad: { title: string; company: string; address: string; description: string };
  template: TemplateId;
};

// Structured CV content produced by AI (JSON), rendered by fixed templates below.
export type CVContent = {
  name: string;
  title: string;
  contact: string; // e.g. "Musterstr. 1, 10115 Berlin · +49 151 … · mail@mail.de"
  profile: string;
  experience: Array<{ position: string; company: string; location: string; period: string; bullets: string[] }>;
  education: Array<{ degree: string; institution: string; location: string; period: string; note: string }>;
  skills: string[];
  languages: Array<{ name: string; level: string }>;
  signature: string;
  photo?: string; // injected after generation
};

// ─── helpers ────────────────────────────────────────────────────────────────
const GF = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');`;

function bullets(arr: string[]): string {
  if (!arr || arr.length === 0) return "";
  return `<ul style="margin:5px 0 0;padding-left:16px;">${arr.map(b => `<li style="margin-bottom:3px;">${b}</li>`).join("")}</ul>`;
}
function sectionTitle(label: string, color: string, border: string): string {
  return `<div style="font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${color};border-bottom:${border};padding-bottom:4px;margin:20px 0 10px;">${label}</div>`;
}

// ─── MODERN ─────────────────────────────────────────────────────────────────
function tplModern(cv: CVContent): string {
  const acc = "#2563eb";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}body,div,p,li,span{font-family:'Inter',sans-serif;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#111827;padding:46px 52px 48px;max-width:794px;">
  <div style="border-bottom:2.5px solid ${acc};padding-bottom:18px;margin-bottom:0;">
    ${cv.photo ? `<img src="${cv.photo}" style="float:right;width:82px;height:104px;object-fit:cover;border-radius:4px;margin-left:18px;" />` : ""}
    <div style="font-family:'Inter',sans-serif;font-size:28px;font-weight:700;letter-spacing:.5px;color:#111827;">${cv.name}</div>
    <div style="font-size:13px;color:${acc};font-weight:600;letter-spacing:.5px;margin-top:4px;">${cv.title}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:8px;">${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  ${cv.profile ? `${sectionTitle("Profil","#374151","1px solid #e5e7eb")}<p style="font-size:12.5px;line-height:1.7;color:#374151;">${cv.profile}</p>` : ""}
  ${cv.experience.length ? `${sectionTitle("Berufserfahrung","#374151","1px solid #e5e7eb")}${cv.experience.map(e=>`
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#111827;">${e.position}</div>
        <div style="font-size:11.5px;color:#6b7280;margin-top:1px;">${e.company}${e.location ? " · "+e.location : ""}</div>
        <div style="font-size:12px;color:#374151;line-height:1.6;margin-top:4px;">${bullets(e.bullets)}</div>
      </div>
      <div style="font-size:11px;color:#9ca3af;white-space:nowrap;padding-left:16px;">${e.period}</div>
    </div>`).join("")}` : ""}
  ${cv.education.length ? `${sectionTitle("Ausbildung","#374151","1px solid #e5e7eb")}${cv.education.map(e=>`
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
      <div><div style="font-size:13px;font-weight:700;color:#111827;">${e.degree}</div><div style="font-size:11.5px;color:#6b7280;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div></div>
      <div style="font-size:11px;color:#9ca3af;white-space:nowrap;padding-left:16px;">${e.period}</div>
    </div>`).join("")}` : ""}
  ${cv.skills.length ? `${sectionTitle("Kenntnisse","#374151","1px solid #e5e7eb")}<div style="display:flex;flex-wrap:wrap;gap:7px;">${cv.skills.map(s=>`<span style="background:#eff6ff;color:#1d4ed8;border-radius:4px;padding:4px 11px;font-size:11.5px;font-weight:500;">${s}</span>`).join("")}</div>` : ""}
  ${cv.languages.length ? `${sectionTitle("Sprachen","#374151","1px solid #e5e7eb")}${cv.languages.map(l=>`<div style="font-size:12.5px;margin-bottom:4px;"><strong>${l.name}</strong> <span style="color:#6b7280;">— ${l.level}</span></div>`).join("")}` : ""}
  <div style="margin-top:36px;font-size:12px;color:#374151;">${cv.signature}</div>
</div>`;
}

// ─── CLASSIC ────────────────────────────────────────────────────────────────
function tplClassic(cv: CVContent): string {
  function row(date: string, content: string): string {
    return `<div style="display:grid;grid-template-columns:118px 1fr;gap:16px;margin-bottom:11px;">
      <div style="font-size:11px;color:#6b7280;padding-top:2px;line-height:1.5;">${date}</div>
      <div>${content}</div></div>`;
  }
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#111827;padding:46px 52px 48px;max-width:794px;font-family:'Inter',sans-serif;">
  <div style="border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:0;">
    ${cv.photo ? `<img src="${cv.photo}" style="float:right;width:82px;height:104px;object-fit:cover;border-radius:4px;margin-left:18px;" />` : ""}
    <div style="font-family:'Playfair Display',serif;font-size:27px;font-weight:700;color:#0f172a;">${cv.name}</div>
    <div style="font-size:12.5px;color:#475569;font-weight:500;margin-top:5px;">${cv.title}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:8px;">${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  ${cv.profile ? `${sectionTitle("Profil","#0f172a","2px solid #0f172a")}<p style="font-size:12.5px;line-height:1.7;color:#374151;">${cv.profile}</p>` : ""}
  ${cv.experience.length ? `${sectionTitle("Berufserfahrung","#0f172a","2px solid #0f172a")}${cv.experience.map(e=>row(e.period,`<div style="font-size:13px;font-weight:700;">${e.position}</div><div style="font-size:11.5px;color:#6b7280;">${e.company}${e.location?" · "+e.location:""}</div>${bullets(e.bullets)}`)).join("")}` : ""}
  ${cv.education.length ? `${sectionTitle("Ausbildung","#0f172a","2px solid #0f172a")}${cv.education.map(e=>row(e.period,`<div style="font-size:13px;font-weight:700;">${e.degree}</div><div style="font-size:11.5px;color:#6b7280;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div>`)).join("")}` : ""}
  ${cv.skills.length ? `${sectionTitle("Kenntnisse","#0f172a","2px solid #0f172a")}<div style="display:flex;flex-wrap:wrap;gap:7px;">${cv.skills.map(s=>`<span style="background:#f1f5f9;border-radius:4px;padding:4px 10px;font-size:11.5px;">${s}</span>`).join("")}</div>` : ""}
  ${cv.languages.length ? `${sectionTitle("Sprachen","#0f172a","2px solid #0f172a")}${cv.languages.map(l=>`<div style="font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#6b7280;">${l.level}</span></div>`).join("")}` : ""}
  <div style="margin-top:36px;font-size:12px;color:#374151;">${cv.signature}</div>
</div>`;
}

// ─── CREATIVE ────────────────────────────────────────────────────────────────
function tplCreative(cv: CVContent): string {
  const side = "#1e3a5f"; const acc = "#3b82f6";
  const sideTitle = (t:string) => `<div style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;font-weight:700;color:${acc};border-bottom:1px solid rgba(255,255,255,.15);padding-bottom:4px;margin:18px 0 8px;">${t}</div>`;
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="display:flex;background:#fff;max-width:794px;min-height:1000px;font-family:'Inter',sans-serif;">
  <div style="width:230px;min-width:230px;background:${side};color:#e2e8f0;padding:36px 22px;flex-shrink:0;">
    ${cv.photo ? `<img src="${cv.photo}" style="width:90px;height:113px;object-fit:cover;border-radius:50%;display:block;margin:0 auto 14px;border:3px solid ${acc};" />` : `<div style="width:72px;height:72px;border-radius:50%;background:${acc};margin:0 auto 14px;"></div>`}
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:15px;font-weight:700;color:#fff;line-height:1.25;">${cv.name}</div>
      <div style="font-size:11px;color:${acc};margin-top:4px;">${cv.title}</div>
    </div>
    ${sideTitle("Kontakt")}<div style="font-size:10.5px;line-height:1.8;word-break:break-all;">${cv.contact.split("·").join("<br>")}</div>
    ${cv.skills.length ? `${sideTitle("Kenntnisse")}${cv.skills.map(s=>`<div style="font-size:11px;margin-bottom:5px;">▸ ${s}</div>`).join("")}` : ""}
    ${cv.languages.length ? `${sideTitle("Sprachen")}${cv.languages.map(l=>`<div style="font-size:11px;margin-bottom:4px;display:flex;justify-content:space-between;"><span>${l.name}</span><span style="color:${acc};">${l.level}</span></div>`).join("")}` : ""}
  </div>
  <div style="flex:1;padding:36px 32px 40px;color:#1f2937;">
    ${cv.profile ? `<div style="font-size:12.5px;line-height:1.7;color:#374151;margin-bottom:4px;">${cv.profile}</div>` : ""}
    ${cv.experience.length ? `${sectionTitle("Berufserfahrung",side,"1.5px solid #e5e7eb")}${cv.experience.map(e=>`
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div style="font-size:13px;font-weight:700;">${e.position}</div>
          <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div>
        </div>
        <div style="font-size:11.5px;color:#6b7280;">${e.company}${e.location?" · "+e.location:""}</div>
        <div style="font-size:12px;margin-top:3px;">${bullets(e.bullets)}</div>
      </div>`).join("")}` : ""}
    ${cv.education.length ? `${sectionTitle("Ausbildung",side,"1.5px solid #e5e7eb")}${cv.education.map(e=>`
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;">
          <div style="font-size:13px;font-weight:700;">${e.degree}</div>
          <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div>
        </div>
        <div style="font-size:11.5px;color:#6b7280;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div>
      </div>`).join("")}` : ""}
    <div style="margin-top:36px;font-size:12px;color:#374151;">${cv.signature}</div>
  </div>
</div>`;
}

// ─── EXECUTIVE ───────────────────────────────────────────────────────────────
function tplExecutive(cv: CVContent): string {
  const navy = "#1e3a8a";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#1f2937;padding:46px 56px 52px;max-width:794px;font-family:'Playfair Display',serif;">
  <div style="border-top:4px solid ${navy};border-bottom:1.5px solid ${navy};padding:16px 0;margin-bottom:0;text-align:center;">
    ${cv.photo ? `<img src="${cv.photo}" style="float:left;width:78px;height:98px;object-fit:cover;border-radius:3px;margin-right:20px;" />` : ""}
    <div style="font-size:26px;font-weight:700;letter-spacing:1px;color:${navy};">${cv.name}</div>
    <div style="font-family:'Inter',sans-serif;font-size:12px;color:#475569;font-weight:500;margin-top:4px;letter-spacing:.5px;">${cv.title}</div>
    <div style="font-family:'Inter',sans-serif;font-size:10.5px;color:#94a3b8;margin-top:7px;">${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  ${cv.profile ? `${sectionTitle("Profil",navy,"1px solid #cbd5e1")}<p style="font-family:'Inter',sans-serif;font-size:12.5px;line-height:1.75;color:#374151;">${cv.profile}</p>` : ""}
  ${cv.experience.length ? `${sectionTitle("Berufliche Laufbahn",navy,"1px solid #cbd5e1")}${cv.experience.map(e=>`
    <div style="margin-bottom:13px;">
      <div style="display:flex;justify-content:space-between;">
        <div style="font-size:13.5px;font-weight:700;color:${navy};">${e.position}</div>
        <div style="font-family:'Inter',sans-serif;font-size:11px;color:#94a3b8;padding-left:14px;white-space:nowrap;">${e.period}</div>
      </div>
      <div style="font-family:'Inter',sans-serif;font-size:11.5px;color:#6b7280;font-style:italic;">${e.company}${e.location?" — "+e.location:""}</div>
      <div style="font-family:'Inter',sans-serif;font-size:12px;margin-top:4px;">${bullets(e.bullets)}</div>
    </div>`).join("")}` : ""}
  ${cv.education.length ? `${sectionTitle("Ausbildung",navy,"1px solid #cbd5e1")}${cv.education.map(e=>`
    <div style="margin-bottom:9px;display:flex;justify-content:space-between;">
      <div><div style="font-size:13px;font-weight:700;">${e.degree}</div><div style="font-family:'Inter',sans-serif;font-size:11.5px;color:#6b7280;font-style:italic;">${e.institution}${e.location?" — "+e.location:""}${e.note?" · "+e.note:""}</div></div>
      <div style="font-family:'Inter',sans-serif;font-size:11px;color:#94a3b8;white-space:nowrap;padding-left:14px;">${e.period}</div>
    </div>`).join("")}` : ""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:4px;">
    ${cv.skills.length ? `<div>${sectionTitle("Kenntnisse",navy,"1px solid #cbd5e1")}<div style="font-family:'Inter',sans-serif;display:flex;flex-wrap:wrap;gap:6px;">${cv.skills.map(s=>`<span style="background:#eff6ff;color:${navy};border-radius:3px;padding:3px 10px;font-size:11px;">${s}</span>`).join("")}</div></div>` : ""}
    ${cv.languages.length ? `<div>${sectionTitle("Sprachen",navy,"1px solid #cbd5e1")}${cv.languages.map(l=>`<div style="font-family:'Inter',sans-serif;font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#6b7280;">${l.level}</span></div>`).join("")}</div>` : ""}
  </div>
  <div style="margin-top:38px;font-family:'Inter',sans-serif;font-size:12px;color:#374151;">${cv.signature}</div>
</div>`;
}

// ─── MINIMAL ─────────────────────────────────────────────────────────────────
function tplMinimal(cv: CVContent): string {
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#111827;padding:56px 64px 56px;max-width:794px;font-family:'Inter',sans-serif;">
  <div style="margin-bottom:32px;">
    ${cv.photo ? `<img src="${cv.photo}" style="float:right;width:78px;height:98px;object-fit:cover;margin-left:20px;" />` : ""}
    <div style="font-size:30px;font-weight:700;color:#111827;letter-spacing:-.5px;">${cv.name}</div>
    <div style="font-size:13px;color:#6b7280;margin-top:5px;">${cv.title}</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:8px;">${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  ${cv.profile ? `<p style="font-size:12.5px;line-height:1.75;color:#374151;margin-bottom:28px;padding-top:20px;border-top:1px solid #f3f4f6;">${cv.profile}</p>` : ""}
  ${cv.experience.length ? `<div style="border-top:1px solid #f3f4f6;padding-top:20px;margin-bottom:0;">${cv.experience.map(e=>`
    <div style="display:flex;gap:20px;margin-bottom:16px;">
      <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-top:2px;min-width:90px;">${e.period}</div>
      <div><div style="font-size:13px;font-weight:600;">${e.position}</div><div style="font-size:11.5px;color:#6b7280;">${e.company}${e.location?" · "+e.location:""}</div><div style="font-size:12px;margin-top:4px;">${bullets(e.bullets)}</div></div>
    </div>`).join("")}</div>` : ""}
  ${cv.education.length ? `<div style="border-top:1px solid #f3f4f6;padding-top:20px;margin-top:8px;">${cv.education.map(e=>`
    <div style="display:flex;gap:20px;margin-bottom:12px;">
      <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-top:2px;min-width:90px;">${e.period}</div>
      <div><div style="font-size:13px;font-weight:600;">${e.degree}</div><div style="font-size:11.5px;color:#6b7280;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div></div>
    </div>`).join("")}</div>` : ""}
  ${cv.skills.length ? `<div style="border-top:1px solid #f3f4f6;padding-top:20px;margin-top:8px;"><div style="font-size:10.5px;color:#9ca3af;margin-bottom:8px;letter-spacing:.1em;text-transform:uppercase;">Kenntnisse</div><div style="font-size:12px;color:#374151;">${cv.skills.join(" · ")}</div></div>` : ""}
  ${cv.languages.length ? `<div style="border-top:1px solid #f3f4f6;padding-top:20px;margin-top:8px;"><div style="font-size:10.5px;color:#9ca3af;margin-bottom:8px;letter-spacing:.1em;text-transform:uppercase;">Sprachen</div>${cv.languages.map(l=>`<span style="font-size:12px;margin-right:16px;"><strong>${l.name}</strong> <span style="color:#9ca3af;">${l.level}</span></span>`).join("")}</div>` : ""}
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${cv.signature}</div>
</div>`;
}

// ─── ELEGANT ─────────────────────────────────────────────────────────────────
function tplElegant(cv: CVContent): string {
  const gold = "#92400e"; const goldL = "#fffbeb";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#1c1917;padding:46px 52px 50px;max-width:794px;font-family:'Playfair Display',serif;">
  <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid ${gold};margin-bottom:0;">
    ${cv.photo ? `<img src="${cv.photo}" style="width:84px;height:106px;object-fit:cover;border-radius:4px;float:right;margin-left:18px;" />` : ""}
    <div style="font-size:28px;font-weight:700;letter-spacing:1.5px;color:#1c1917;">${cv.name}</div>
    <div style="font-family:'Inter',sans-serif;font-size:12px;color:${gold};letter-spacing:2px;text-transform:uppercase;margin-top:6px;">${cv.title}</div>
    <div style="font-family:'Inter',sans-serif;font-size:11px;color:#78716c;margin-top:9px;">${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  ${cv.profile ? `<div style="background:${goldL};border-left:3px solid ${gold};padding:12px 16px;margin:18px 0 0;font-family:'Inter',sans-serif;font-size:12.5px;line-height:1.75;color:#374151;">${cv.profile}</div>` : ""}
  ${cv.experience.length ? `${sectionTitle("Berufserfahrung",gold,`1px solid ${gold}`)}${cv.experience.map(e=>`
    <div style="margin-bottom:13px;">
      <div style="display:flex;justify-content:space-between;">
        <div style="font-size:13.5px;font-weight:700;">${e.position}</div>
        <div style="font-family:'Inter',sans-serif;font-size:10.5px;color:#a8a29e;white-space:nowrap;padding-left:12px;">${e.period}</div>
      </div>
      <div style="font-family:'Inter',sans-serif;font-size:11.5px;color:#78716c;font-style:italic;">${e.company}${e.location?" · "+e.location:""}</div>
      <div style="font-family:'Inter',sans-serif;font-size:12px;margin-top:4px;">${bullets(e.bullets)}</div>
    </div>`).join("")}` : ""}
  ${cv.education.length ? `${sectionTitle("Ausbildung",gold,`1px solid ${gold}`)}${cv.education.map(e=>`
    <div style="margin-bottom:9px;display:flex;justify-content:space-between;">
      <div><div style="font-size:13px;font-weight:700;">${e.degree}</div><div style="font-family:'Inter',sans-serif;font-size:11.5px;color:#78716c;font-style:italic;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div></div>
      <div style="font-family:'Inter',sans-serif;font-size:10.5px;color:#a8a29e;white-space:nowrap;padding-left:12px;">${e.period}</div>
    </div>`).join("")}` : ""}
  ${cv.skills.length ? `${sectionTitle("Kenntnisse",gold,`1px solid ${gold}`)}<div style="font-family:'Inter',sans-serif;display:flex;flex-wrap:wrap;gap:7px;">${cv.skills.map(s=>`<span style="background:${goldL};color:${gold};border:1px solid #fde68a;border-radius:3px;padding:4px 11px;font-size:11.5px;">${s}</span>`).join("")}</div>` : ""}
  ${cv.languages.length ? `${sectionTitle("Sprachen",gold,`1px solid ${gold}`)}${cv.languages.map(l=>`<div style="font-family:'Inter',sans-serif;font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#78716c;">${l.level}</span></div>`).join("")}` : ""}
  <div style="margin-top:38px;font-family:'Inter',sans-serif;font-size:12px;color:#374151;">${cv.signature}</div>
</div>`;
}

// ─── BOLD ────────────────────────────────────────────────────────────────────
function tplBold(cv: CVContent): string {
  const dark = "#0f172a"; const acc = "#f8fafc";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#1f2937;max-width:794px;font-family:'Inter',sans-serif;">
  <div style="background:${dark};color:${acc};padding:32px 52px;">
    ${cv.photo ? `<img src="${cv.photo}" style="float:right;width:82px;height:104px;object-fit:cover;border-radius:4px;margin-left:18px;border:2px solid rgba(255,255,255,.2);" />` : ""}
    <div style="font-size:28px;font-weight:700;letter-spacing:.5px;">${cv.name}</div>
    <div style="font-size:13px;color:#94a3b8;font-weight:500;margin-top:5px;letter-spacing:.5px;">${cv.title}</div>
    <div style="font-size:11px;color:#64748b;margin-top:10px;">${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  <div style="padding:28px 52px 46px;">
    ${cv.profile ? `<p style="font-size:12.5px;line-height:1.75;color:#374151;margin-bottom:4px;">${cv.profile}</p>` : ""}
    ${cv.experience.length ? `${sectionTitle("Berufserfahrung",dark,`2px solid ${dark}`)}${cv.experience.map(e=>`
      <div style="margin-bottom:13px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div style="font-size:13px;font-weight:700;color:${dark};">${e.position}</div>
          <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div>
        </div>
        <div style="font-size:11.5px;color:#6b7280;">${e.company}${e.location?" · "+e.location:""}</div>
        <div style="font-size:12px;margin-top:4px;">${bullets(e.bullets)}</div>
      </div>`).join("")}` : ""}
    ${cv.education.length ? `${sectionTitle("Ausbildung",dark,`2px solid ${dark}`)}${cv.education.map(e=>`
      <div style="margin-bottom:9px;display:flex;justify-content:space-between;">
        <div><div style="font-size:13px;font-weight:700;">${e.degree}</div><div style="font-size:11.5px;color:#6b7280;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div></div>
        <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div>
      </div>`).join("")}` : ""}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:4px;">
      ${cv.skills.length ? `<div>${sectionTitle("Kenntnisse",dark,`2px solid ${dark}`)}<div style="display:flex;flex-wrap:wrap;gap:6px;">${cv.skills.map(s=>`<span style="background:#f1f5f9;color:${dark};border-radius:3px;padding:4px 10px;font-size:11.5px;font-weight:500;">${s}</span>`).join("")}</div></div>` : ""}
      ${cv.languages.length ? `<div>${sectionTitle("Sprachen",dark,`2px solid ${dark}`)}${cv.languages.map(l=>`<div style="font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#6b7280;">${l.level}</span></div>`).join("")}</div>` : ""}
    </div>
    <div style="margin-top:38px;font-size:12px;color:#374151;">${cv.signature}</div>
  </div>
</div>`;
}

// ─── COMPACT ─────────────────────────────────────────────────────────────────
function tplCompact(cv: CVContent): string {
  const acc = "#1f2937";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#111827;padding:32px 44px 36px;max-width:794px;font-family:'Inter',sans-serif;font-size:11.5px;line-height:1.5;">
  <div style="border-bottom:1.5px solid ${acc};padding-bottom:10px;margin-bottom:0;">
    ${cv.photo ? `<img src="${cv.photo}" style="float:right;width:64px;height:82px;object-fit:cover;border-radius:3px;margin-left:14px;" />` : ""}
    <div style="font-size:22px;font-weight:700;color:${acc};">${cv.name}</div>
    <div style="font-size:11.5px;color:#6b7280;margin-top:2px;">${cv.title} · ${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  ${cv.profile ? `<p style="font-size:11.5px;line-height:1.65;color:#374151;margin:10px 0 0;">${cv.profile}</p>` : ""}
  ${cv.experience.length ? `<div style="font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${acc};border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin:12px 0 7px;">Berufserfahrung</div>${cv.experience.map(e=>`
    <div style="display:flex;gap:10px;margin-bottom:8px;">
      <div style="font-size:10px;color:#9ca3af;white-space:nowrap;padding-top:2px;min-width:80px;">${e.period}</div>
      <div><strong>${e.position}</strong> · ${e.company}${e.location?" · "+e.location:""}${e.bullets?.length?`<br><span style="color:#374151;">${e.bullets.join(" · ")}</span>`:""}</div>
    </div>`).join("")}` : ""}
  ${cv.education.length ? `<div style="font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${acc};border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin:12px 0 7px;">Ausbildung</div>${cv.education.map(e=>`
    <div style="display:flex;gap:10px;margin-bottom:6px;">
      <div style="font-size:10px;color:#9ca3af;white-space:nowrap;min-width:80px;">${e.period}</div>
      <div><strong>${e.degree}</strong> · ${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div>
    </div>`).join("")}` : ""}
  ${cv.skills.length||cv.languages.length ? `<div style="display:flex;gap:24px;margin-top:10px;">
    ${cv.skills.length?`<div style="flex:1;"><div style="font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${acc};margin-bottom:5px;">Kenntnisse</div><div style="display:flex;flex-wrap:wrap;gap:5px;">${cv.skills.map(s=>`<span style="background:#f3f4f6;border-radius:3px;padding:2px 8px;font-size:11px;">${s}</span>`).join("")}</div></div>`:""}
    ${cv.languages.length?`<div><div style="font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${acc};margin-bottom:5px;">Sprachen</div>${cv.languages.map(l=>`<div style="margin-bottom:2px;"><strong>${l.name}</strong> <span style="color:#6b7280;">${l.level}</span></div>`).join("")}</div>`:""}
  </div>` : ""}
  <div style="margin-top:22px;font-size:11px;color:#374151;">${cv.signature}</div>
</div>`;
}

// ─── SWISS ───────────────────────────────────────────────────────────────────
function tplSwiss(cv: CVContent): string {
  const red = "#dc2626";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#111;padding:46px 56px 52px;max-width:794px;font-family:'Inter',sans-serif;">
  <div style="margin-bottom:24px;">
    ${cv.photo ? `<img src="${cv.photo}" style="float:right;width:80px;height:100px;object-fit:cover;border-radius:2px;margin-left:18px;" />` : ""}
    <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${red};font-weight:700;margin-bottom:6px;">Curriculum Vitae</div>
    <div style="font-size:30px;font-weight:700;letter-spacing:-.5px;line-height:1.1;">${cv.name}</div>
    <div style="font-size:13px;color:#555;margin-top:5px;">${cv.title}</div>
    <div style="clear:both;"></div>
  </div>
  <div style="height:3px;background:${red};margin-bottom:6px;"></div>
  <div style="font-size:10.5px;color:#888;margin-bottom:20px;">${cv.contact}</div>
  ${cv.profile ? `<div style="border-left:3px solid ${red};padding-left:14px;margin-bottom:20px;font-size:12.5px;line-height:1.75;color:#333;">${cv.profile}</div>` : ""}
  ${cv.experience.length ? `<div style="height:1px;background:#e5e7eb;margin:0 0 14px;"></div><div style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${red};margin-bottom:10px;">Berufserfahrung</div>${cv.experience.map(e=>`
    <div style="display:grid;grid-template-columns:120px 1fr;gap:14px;margin-bottom:12px;">
      <div style="font-size:10.5px;color:#999;line-height:1.5;padding-top:2px;">${e.period}</div>
      <div><div style="font-size:13px;font-weight:700;">${e.position}</div><div style="font-size:11.5px;color:#666;">${e.company}${e.location?" · "+e.location:""}</div>${bullets(e.bullets)}</div>
    </div>`).join("")}` : ""}
  ${cv.education.length ? `<div style="height:1px;background:#e5e7eb;margin:14px 0 14px;"></div><div style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${red};margin-bottom:10px;">Ausbildung</div>${cv.education.map(e=>`
    <div style="display:grid;grid-template-columns:120px 1fr;gap:14px;margin-bottom:10px;">
      <div style="font-size:10.5px;color:#999;">${e.period}</div>
      <div><div style="font-size:13px;font-weight:700;">${e.degree}</div><div style="font-size:11.5px;color:#666;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div></div>
    </div>`).join("")}` : ""}
  <div style="height:1px;background:#e5e7eb;margin:14px 0 14px;"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
    ${cv.skills.length ? `<div><div style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${red};margin-bottom:8px;">Kenntnisse</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${cv.skills.map(s=>`<span style="background:#fef2f2;color:${red};border:1px solid #fecaca;border-radius:2px;padding:3px 9px;font-size:11px;">${s}</span>`).join("")}</div></div>` : ""}
    ${cv.languages.length ? `<div><div style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${red};margin-bottom:8px;">Sprachen</div>${cv.languages.map(l=>`<div style="font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#888;">${l.level}</span></div>`).join("")}</div>` : ""}
  </div>
  <div style="margin-top:36px;font-size:12px;color:#555;">${cv.signature}</div>
</div>`;
}

// ─── NORDIC ──────────────────────────────────────────────────────────────────
function tplNordic(cv: CVContent): string {
  const teal = "#0d9488"; const tealL = "#f0fdfa";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#111827;padding:52px 60px 56px;max-width:794px;font-family:'Inter',sans-serif;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
    <div>
      <div style="font-size:32px;font-weight:700;letter-spacing:-.5px;color:#111827;">${cv.name}</div>
      <div style="font-size:13.5px;color:${teal};font-weight:500;margin-top:6px;">${cv.title}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:8px;line-height:1.8;">${cv.contact.split("·").join(" ·\u00A0")}</div>
    </div>
    ${cv.photo ? `<img src="${cv.photo}" style="width:82px;height:104px;object-fit:cover;border-radius:8px;flex-shrink:0;margin-left:24px;" />` : ""}
  </div>
  ${cv.profile ? `<div style="background:${tealL};border-radius:8px;padding:16px 18px;margin-bottom:28px;font-size:12.5px;line-height:1.75;color:#374151;">${cv.profile}</div>` : ""}
  ${cv.experience.length ? `<div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${teal};border-bottom:2px solid ${teal};padding-bottom:4px;margin-bottom:14px;">Berufserfahrung</div>${cv.experience.map(e=>`
    <div style="margin-bottom:14px;padding-left:14px;border-left:2px solid #e5e7eb;">
      <div style="display:flex;justify-content:space-between;"><div style="font-size:13px;font-weight:700;">${e.position}</div><div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div></div>
      <div style="font-size:11.5px;color:#6b7280;margin-top:1px;">${e.company}${e.location?" · "+e.location:""}</div>
      <div style="font-size:12px;margin-top:3px;">${bullets(e.bullets)}</div>
    </div>`).join("")}` : ""}
  ${cv.education.length ? `<div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${teal};border-bottom:2px solid ${teal};padding-bottom:4px;margin:20px 0 14px;">Ausbildung</div>${cv.education.map(e=>`
    <div style="margin-bottom:10px;padding-left:14px;border-left:2px solid #e5e7eb;">
      <div style="display:flex;justify-content:space-between;"><div style="font-size:13px;font-weight:700;">${e.degree}</div><div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div></div>
      <div style="font-size:11.5px;color:#6b7280;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div>
    </div>`).join("")}` : ""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:20px;">
    ${cv.skills.length ? `<div><div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${teal};margin-bottom:8px;">Kenntnisse</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${cv.skills.map(s=>`<span style="background:${tealL};color:${teal};border-radius:20px;padding:4px 12px;font-size:11px;font-weight:500;">${s}</span>`).join("")}</div></div>` : ""}
    ${cv.languages.length ? `<div><div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${teal};margin-bottom:8px;">Sprachen</div>${cv.languages.map(l=>`<div style="font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#6b7280;">${l.level}</span></div>`).join("")}</div>` : ""}
  </div>
  <div style="margin-top:38px;font-size:12px;color:#6b7280;">${cv.signature}</div>
</div>`;
}

// ─── CORPORATE ───────────────────────────────────────────────────────────────
function tplCorporate(cv: CVContent): string {
  const grn = "#065f46"; const grnL = "#ecfdf5"; const acc = "#10b981";
  const sT = (t:string) => `<div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${acc};border-bottom:1px solid rgba(255,255,255,.15);padding-bottom:4px;margin:16px 0 8px;">${t}</div>`;
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="display:flex;background:#fff;max-width:794px;min-height:1000px;font-family:'Inter',sans-serif;">
  <div style="width:220px;min-width:220px;background:${grn};color:#d1fae5;padding:36px 20px;flex-shrink:0;">
    ${cv.photo ? `<img src="${cv.photo}" style="width:84px;height:106px;object-fit:cover;border-radius:4px;display:block;margin:0 auto 16px;border:2px solid ${acc};" />` : `<div style="width:60px;height:60px;border-radius:50%;background:${acc};margin:0 auto 16px;opacity:.4;"></div>`}
    <div style="font-size:15px;font-weight:700;color:#fff;text-align:center;line-height:1.25;margin-bottom:4px;">${cv.name}</div>
    <div style="font-size:10.5px;color:${acc};text-align:center;margin-bottom:18px;">${cv.title}</div>
    ${sT("Kontakt")}<div style="font-size:10.5px;line-height:1.9;word-break:break-all;">${cv.contact.split("·").join("<br>")}</div>
    ${cv.skills.length ? `${sT("Kenntnisse")}${cv.skills.map(s=>`<div style="font-size:10.5px;margin-bottom:5px;display:flex;align-items:center;gap:6px;"><span style="width:5px;height:5px;border-radius:50%;background:${acc};flex-shrink:0;"></span>${s}</div>`).join("")}` : ""}
    ${cv.languages.length ? `${sT("Sprachen")}${cv.languages.map(l=>`<div style="font-size:10.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><span>${l.name}</span><span style="color:${acc};">${l.level}</span></div>`).join("")}` : ""}
  </div>
  <div style="flex:1;padding:36px 30px 40px;">
    ${cv.profile ? `<div style="background:${grnL};border-left:3px solid ${acc};padding:12px 16px;margin-bottom:22px;font-size:12.5px;line-height:1.75;color:#374151;border-radius:0 6px 6px 0;">${cv.profile}</div>` : ""}
    ${cv.experience.length ? `<div style="font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${grn};border-bottom:2px solid ${grn};padding-bottom:4px;margin-bottom:12px;">Berufserfahrung</div>${cv.experience.map(e=>`
      <div style="margin-bottom:13px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div style="font-size:13px;font-weight:700;color:${grn};">${e.position}</div>
          <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div>
        </div>
        <div style="font-size:11.5px;color:#6b7280;">${e.company}${e.location?" · "+e.location:""}</div>
        <div style="font-size:12px;margin-top:4px;">${bullets(e.bullets)}</div>
      </div>`).join("")}` : ""}
    ${cv.education.length ? `<div style="font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${grn};border-bottom:2px solid ${grn};padding-bottom:4px;margin:18px 0 12px;">Ausbildung</div>${cv.education.map(e=>`
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;">
          <div style="font-size:13px;font-weight:700;color:${grn};">${e.degree}</div>
          <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div>
        </div>
        <div style="font-size:11.5px;color:#6b7280;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div>
      </div>`).join("")}` : ""}
    <div style="margin-top:36px;font-size:12px;color:#374151;">${cv.signature}</div>
  </div>
</div>`;
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────
function tplTimeline(cv: CVContent): string {
  const org = "#ea580c"; const orgL = "#fff7ed";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#111827;padding:46px 52px 52px;max-width:794px;font-family:'Inter',sans-serif;">
  <div style="border-bottom:3px solid ${org};padding-bottom:18px;margin-bottom:22px;">
    ${cv.photo ? `<img src="${cv.photo}" style="float:right;width:82px;height:104px;object-fit:cover;border-radius:6px;margin-left:18px;" />` : ""}
    <div style="font-size:28px;font-weight:700;letter-spacing:-.3px;">${cv.name}</div>
    <div style="font-size:13px;color:${org};font-weight:600;margin-top:4px;">${cv.title}</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:7px;">${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  ${cv.profile ? `<div style="background:${orgL};border-radius:6px;padding:12px 16px;margin-bottom:22px;font-size:12.5px;line-height:1.75;color:#374151;">${cv.profile}</div>` : ""}
  ${cv.experience.length ? `<div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${org};margin-bottom:14px;">Berufserfahrung</div>
  <div style="position:relative;padding-left:28px;border-left:2px solid #fed7aa;">
    ${cv.experience.map((e,i)=>`
    <div style="position:relative;margin-bottom:16px;">
      <div style="position:absolute;left:-35px;top:3px;width:13px;height:13px;border-radius:50%;background:${i===0?org:"#fed7aa"};border:2px solid #fff;box-shadow:0 0 0 2px ${org};"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-size:13px;font-weight:700;">${e.position}</div>
        <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div>
      </div>
      <div style="font-size:11.5px;color:#6b7280;">${e.company}${e.location?" · "+e.location:""}</div>
      <div style="font-size:12px;margin-top:3px;">${bullets(e.bullets)}</div>
    </div>`).join("")}
  </div>` : ""}
  ${cv.education.length ? `<div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${org};margin:20px 0 14px;">Ausbildung</div>
  <div style="position:relative;padding-left:28px;border-left:2px solid #fed7aa;">
    ${cv.education.map(e=>`
    <div style="position:relative;margin-bottom:10px;">
      <div style="position:absolute;left:-35px;top:3px;width:13px;height:13px;border-radius:50%;background:#fed7aa;border:2px solid #fff;box-shadow:0 0 0 2px ${org};"></div>
      <div style="display:flex;justify-content:space-between;">
        <div style="font-size:13px;font-weight:700;">${e.degree}</div>
        <div style="font-size:10.5px;color:#9ca3af;white-space:nowrap;padding-left:12px;">${e.period}</div>
      </div>
      <div style="font-size:11.5px;color:#6b7280;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div>
    </div>`).join("")}
  </div>` : ""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:22px;">
    ${cv.skills.length ? `<div><div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${org};margin-bottom:8px;">Kenntnisse</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${cv.skills.map(s=>`<span style="background:${orgL};color:${org};border-radius:4px;padding:4px 10px;font-size:11px;font-weight:500;border:1px solid #fed7aa;">${s}</span>`).join("")}</div></div>` : ""}
    ${cv.languages.length ? `<div><div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${org};margin-bottom:8px;">Sprachen</div>${cv.languages.map(l=>`<div style="font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#6b7280;">${l.level}</span></div>`).join("")}</div>` : ""}
  </div>
  <div style="margin-top:38px;font-size:12px;color:#374151;">${cv.signature}</div>
</div>`;
}

// ─── SLATE ───────────────────────────────────────────────────────────────────
function tplSlate(cv: CVContent): string {
  const slate = "#334155"; const slateL = "#f8fafc";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fff;color:#1f2937;max-width:794px;font-family:'Inter',sans-serif;">
  <div style="background:${slate};padding:32px 52px 28px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-.3px;">${cv.name}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:5px;">${cv.title}</div>
        <div style="font-size:11px;color:#64748b;margin-top:9px;">${cv.contact}</div>
      </div>
      ${cv.photo ? `<img src="${cv.photo}" style="width:80px;height:100px;object-fit:cover;border-radius:4px;border:2px solid #475569;" />` : ""}
    </div>
  </div>
  <div style="padding:28px 52px 46px;">
    ${cv.profile ? `<p style="font-size:12.5px;line-height:1.75;color:#374151;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #e2e8f0;">${cv.profile}</p>` : ""}
    ${cv.experience.length ? `<div style="font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${slate};border-bottom:2px solid ${slate};padding-bottom:4px;margin-bottom:14px;">Berufserfahrung</div>${cv.experience.map(e=>`
      <div style="display:grid;grid-template-columns:110px 1fr;gap:16px;margin-bottom:13px;">
        <div style="font-size:10.5px;color:#94a3b8;padding-top:2px;line-height:1.5;">${e.period}</div>
        <div>
          <div style="font-size:13px;font-weight:700;">${e.position}</div>
          <div style="font-size:11.5px;color:#64748b;">${e.company}${e.location?" · "+e.location:""}</div>
          <div style="font-size:12px;margin-top:3px;">${bullets(e.bullets)}</div>
        </div>
      </div>`).join("")}` : ""}
    ${cv.education.length ? `<div style="font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${slate};border-bottom:2px solid ${slate};padding-bottom:4px;margin:18px 0 14px;">Ausbildung</div>${cv.education.map(e=>`
      <div style="display:grid;grid-template-columns:110px 1fr;gap:16px;margin-bottom:10px;">
        <div style="font-size:10.5px;color:#94a3b8;">${e.period}</div>
        <div><div style="font-size:13px;font-weight:700;">${e.degree}</div><div style="font-size:11.5px;color:#64748b;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div></div>
      </div>`).join("")}` : ""}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:18px;">
      ${cv.skills.length ? `<div><div style="font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${slate};margin-bottom:8px;">Kenntnisse</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${cv.skills.map(s=>`<span style="background:${slateL};color:${slate};border:1px solid #e2e8f0;border-radius:3px;padding:4px 10px;font-size:11px;">${s}</span>`).join("")}</div></div>` : ""}
      ${cv.languages.length ? `<div><div style="font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${slate};margin-bottom:8px;">Sprachen</div>${cv.languages.map(l=>`<div style="font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#64748b;">${l.level}</span></div>`).join("")}</div>` : ""}
    </div>
    <div style="margin-top:38px;font-size:12px;color:#374151;">${cv.signature}</div>
  </div>
</div>`;
}

// ─── TERRA ───────────────────────────────────────────────────────────────────
function tplTerra(cv: CVContent): string {
  const terra = "#c2410c"; const terL = "#fff7ed"; const brown = "#7c2d12";
  return `<style>${GF}*{box-sizing:border-box;margin:0;padding:0;}ul{list-style:disc;}</style>
<div style="background:#fffbf7;color:#1c1917;padding:46px 52px 52px;max-width:794px;font-family:'Playfair Display',serif;">
  <div style="text-align:center;border-bottom:1px solid #fed7aa;padding-bottom:20px;margin-bottom:22px;">
    ${cv.photo ? `<img src="${cv.photo}" style="width:84px;height:106px;object-fit:cover;border-radius:4px;float:right;margin-left:18px;" />` : ""}
    <div style="font-size:10px;font-family:'Inter',sans-serif;letter-spacing:.22em;text-transform:uppercase;color:${terra};font-weight:700;margin-bottom:8px;">Bewerbung</div>
    <div style="font-size:28px;font-weight:700;letter-spacing:.5px;color:${brown};">${cv.name}</div>
    <div style="font-family:'Inter',sans-serif;font-size:12px;color:${terra};margin-top:6px;letter-spacing:1px;">${cv.title}</div>
    <div style="font-family:'Inter',sans-serif;font-size:11px;color:#a8a29e;margin-top:8px;">${cv.contact}</div>
    <div style="clear:both;"></div>
  </div>
  ${cv.profile ? `<div style="background:${terL};border:1px solid #fed7aa;border-radius:6px;padding:14px 18px;margin-bottom:22px;font-family:'Inter',sans-serif;font-size:12.5px;line-height:1.75;color:#374151;">${cv.profile}</div>` : ""}
  ${cv.experience.length ? `<div style="font-size:9px;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${terra};border-bottom:1px solid #fed7aa;padding-bottom:5px;margin-bottom:12px;">Berufserfahrung</div>${cv.experience.map(e=>`
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-size:13.5px;font-weight:700;color:${brown};">${e.position}</div>
        <div style="font-family:'Inter',sans-serif;font-size:10.5px;color:#a8a29e;white-space:nowrap;padding-left:12px;">${e.period}</div>
      </div>
      <div style="font-family:'Inter',sans-serif;font-size:11.5px;color:#78716c;font-style:italic;">${e.company}${e.location?" · "+e.location:""}</div>
      <div style="font-family:'Inter',sans-serif;font-size:12px;margin-top:4px;">${bullets(e.bullets)}</div>
    </div>`).join("")}` : ""}
  ${cv.education.length ? `<div style="font-size:9px;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${terra};border-bottom:1px solid #fed7aa;padding-bottom:5px;margin:18px 0 12px;">Ausbildung</div>${cv.education.map(e=>`
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;">
        <div style="font-size:13px;font-weight:700;color:${brown};">${e.degree}</div>
        <div style="font-family:'Inter',sans-serif;font-size:10.5px;color:#a8a29e;white-space:nowrap;padding-left:12px;">${e.period}</div>
      </div>
      <div style="font-family:'Inter',sans-serif;font-size:11.5px;color:#78716c;font-style:italic;">${e.institution}${e.location?" · "+e.location:""}${e.note?" · "+e.note:""}</div>
    </div>`).join("")}` : ""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:18px;">
    ${cv.skills.length ? `<div><div style="font-size:9px;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${terra};margin-bottom:8px;">Kenntnisse</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${cv.skills.map(s=>`<span style="background:${terL};color:${terra};border:1px solid #fed7aa;border-radius:3px;padding:4px 11px;font-family:'Inter',sans-serif;font-size:11px;">${s}</span>`).join("")}</div></div>` : ""}
    ${cv.languages.length ? `<div><div style="font-size:9px;font-family:'Inter',sans-serif;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${terra};margin-bottom:8px;">Sprachen</div>${cv.languages.map(l=>`<div style="font-family:'Inter',sans-serif;font-size:12.5px;margin-bottom:4px;display:flex;justify-content:space-between;"><strong>${l.name}</strong><span style="color:#78716c;">${l.level}</span></div>`).join("")}</div>` : ""}
  </div>
  <div style="margin-top:38px;font-family:'Inter',sans-serif;font-size:12px;color:#78716c;">${cv.signature}</div>
</div>`;
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
export function renderCVContent(cv: CVContent, template: TemplateId): string {
  switch (template) {
    case "classic":    return tplClassic(cv);
    case "creative":   return tplCreative(cv);
    case "executive":  return tplExecutive(cv);
    case "minimal":    return tplMinimal(cv);
    case "elegant":    return tplElegant(cv);
    case "bold":       return tplBold(cv);
    case "compact":    return tplCompact(cv);
    case "swiss":      return tplSwiss(cv);
    case "nordic":     return tplNordic(cv);
    case "corporate":  return tplCorporate(cv);
    case "timeline":   return tplTimeline(cv);
    case "slate":      return tplSlate(cv);
    case "terra":      return tplTerra(cv);
    default:           return tplModern(cv);
  }
}

// Legacy helper still used for the Documents list preview
export function buildCVHTML(profile: FormData, template: string): string {
  const p = profile?.personal || {} as PersonalData;
  const exp = profile?.experience || [];
  const edu = profile?.education || [];
  const skills = profile?.skills || [];
  const langs = profile?.languages || [];
  const cv: CVContent = {
    name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
    title: p.title || "",
    contact: [p.email, p.phone, p.city ? `${p.zip||""} ${p.city}`.trim() : "", p.linkedin].filter(Boolean).join(" · "),
    profile: p.summary || "",
    experience: exp.map(e => ({
      position: e.position, company: e.company, location: e.city,
      period: `${e.start?.slice(0,7).replace("-","/") || ""}${e.start&&(e.end||e.current)?" – ":""}${e.current?"heute":(e.end?.slice(0,7).replace("-","/")||"")}`,
      bullets: e.description ? [e.description] : [],
    })),
    education: edu.map(e => ({
      degree: `${e.degree}${e.field?" – "+e.field:""}`,
      institution: e.institution, location: e.city,
      period: `${e.start?.slice(0,7).replace("-","/")||""} – ${e.end?.slice(0,7).replace("-","/")||""}`,
      note: e.grade ? `Note: ${e.grade}` : "",
    })),
    skills: skills.map(s => s.name),
    languages: langs.map(l => ({ name: l.language, level: l.level })),
    signature: "",
    photo: p.photo,
  };
  return renderCVContent(cv, template as TemplateId);
}
