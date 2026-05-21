export type PersonalData = {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  linkedin: string;
  website: string;
  summary: string;
};

export type Experience = {
  company: string;
  position: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
};

export type Education = {
  institution: string;
  degree: string;
  field: string;
  grade: string;
  start: string;
  end: string;
};

export type Skill = {
  name: string;
  level: number;
};

export type Language = {
  language: string;
  level: string;
};

export type FormData = {
  personal: PersonalData;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  languages: Language[];
  jobad: { title: string; company: string; description: string };
  template: "modern" | "classic" | "creative";
};

export function buildCVHTML(profile: FormData, template: string): string {
  const p = profile?.personal || {};
  const exp = profile?.experience || [];
  const edu = profile?.education || [];
  const skills = profile?.skills || [];
  const langs = profile?.languages || [];
  const name = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  const contact = [p.email, p.phone, p.city ? `${p.zip || ""} ${p.city}`.trim() : "", p.linkedin].filter(Boolean);

  const cvStyles = `
    .cv-h{padding:36px 40px}.cv-h h1{font-size:24px;font-weight:700;letter-spacing:-.02em;font-family:'Fraunces',serif;margin-bottom:4px}
    .cv-h .sub{font-size:13px;opacity:.85;margin-bottom:14px}.cv-h .con{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;opacity:.9}
    .cv-body{display:grid}.cv-side{padding:24px 20px;border-top:1px solid rgba(0,0,0,.08)}.cv-main{padding:24px 28px}
    .sec-t{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;padding-bottom:4px;border-bottom:2px solid currentColor}
    .sec{margin-bottom:20px}
    .ent{margin-bottom:12px}.ent-t{font-weight:700;font-size:13px}.ent-s{font-size:11px;color:#6b7280;margin-bottom:2px}.ent-d{font-size:12px;color:#374151;line-height:1.5}
    .sk{margin-bottom:7px}.sk-l{font-size:12px;margin-bottom:3px;display:flex;justify-content:space-between}.sk-b{height:5px;background:#e8eef8;border-radius:3px;overflow:hidden}.sk-f{height:100%;border-radius:3px}
    .lang-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;color:#374151}
  `;

  if (template === "classic") {
    return `<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Geist:wght@400;600;700&display=swap');${cvStyles}
    .cv-h{border-bottom:3px solid #0f172a;background:#fff}.cv-h h1{color:#0f172a}.cv-h .sub{color:#6b7280}.cv-h .con{color:#374151}
    .cv-body{grid-template-columns:1fr}.cv-main{padding:28px 40px}
    .sec-t{color:#0f172a;border-color:#0f172a}
    .ent{display:grid;grid-template-columns:130px 1fr;gap:14px}.ent-date{font-size:11px;color:#6b7280;padding-top:2px}
    </style>
    <div class="cv-h"><h1>${name}</h1><div class="sub">${p.title || ""}</div><div class="con">${contact.map(c => `<span>${c}</span>`).join("")}</div></div>
    <div class="cv-body"><div class="cv-main">
    ${p.summary ? `<div class="sec"><div class="sec-t">Profil</div><p style="font-size:13px;color:#374151;line-height:1.6">${p.summary}</p></div>` : ""}
    ${exp.length ? `<div class="sec"><div class="sec-t">Berufserfahrung</div>${exp.map(e => `<div class="ent"><div class="ent-date">${e.start ? e.start.slice(0, 7).replace("-", "/") + "" : " "}${e.start && (e.end || e.current) ? " –<br>" : ""}${e.current ? "heute" : (e.end ? e.end.slice(0, 7).replace("-", "/") : "")}</div><div><div class="ent-t">${e.position}</div><div class="ent-s">${e.company}</div><div class="ent-d">${e.description || ""}</div></div></div>`).join("")}</div>` : ""}
    ${edu.length ? `<div class="sec"><div class="sec-t">Ausbildung</div>${edu.map(e => `<div class="ent"><div class="ent-date">${e.start ? e.start.slice(0, 7).replace("-", "/") : ""} – ${e.end ? e.end.slice(0, 7).replace("-", "/") : ""}</div><div><div class="ent-t">${e.degree}${e.field ? " – " + e.field : ""}</div><div class="ent-s">${e.institution}${e.grade ? " · Note: " + e.grade : ""}</div></div></div>`).join("")}</div>` : ""}
    ${skills.length ? `<div class="sec"><div class="sec-t">Kenntnisse</div><div style="display:flex;flex-wrap:wrap;gap:7px">${skills.map(s => `<span style="background:#f1f5f9;padding:3px 9px;border-radius:4px;font-size:12px">${s.name}</span>`).join("")}</div></div>` : ""}
    ${langs.length ? `<div class="sec"><div class="sec-t">Sprachen</div>${langs.map(l => `<div class="lang-row"><span>${l.language}</span><span style="color:#6b7280">${l.level}</span></div>`).join("")}</div>` : ""}
    </div></div>`;
  }

  const isCreative = template === "creative";
  const brandColor = isCreative ? "#1e3a8a" : "#1a56db";
  const headerBg = isCreative ? "background:linear-gradient(135deg,#0f172a,#1e3a8a)" : "background:#1a56db";

  return `<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Geist:wght@400;600;700&display=swap');${cvStyles}
  .cv-h{${headerBg};color:white}.cv-h h1{color:white}.cv-h .con{opacity:.88}
  .cv-body{grid-template-columns:${isCreative ? "1fr 240px" : "220px 1fr"}}.cv-side{${isCreative ? "border-left" : "border-right"}:1px solid #e8eef8;background:#f8faff;border-top:none}
  .sec-t{color:${brandColor};border-color:${brandColor}}
  .sk-f{background:${brandColor}}
  </style>
  <div class="cv-h"><h1>${name}</h1><div class="sub">${p.title || ""}</div><div class="con">${contact.map(c => `<span>${c}</span>`).join("")}</div></div>
  <div class="cv-body">
  ${isCreative ? "" : `<div class="cv-side">
    ${skills.length ? `<div class="sec"><div class="sec-t" style="color:${brandColor}">Kenntnisse</div>${skills.map(s => `<div class="sk"><div class="sk-l"><span>${s.name}</span></div><div class="sk-b"><div class="sk-f" style="width:${s.level || 80}%"></div></div></div>`).join("")}</div>` : ""}
    ${langs.length ? `<div class="sec"><div class="sec-t" style="color:${brandColor}">Sprachen</div>${langs.map(l => `<div class="lang-row"><span>${l.language}</span><span style="color:#6b7280">${l.level}</span></div>`).join("")}</div>` : ""}
  </div>`}
  <div class="cv-main">
    ${p.summary ? `<div class="sec"><div class="sec-t" style="color:${brandColor}">Profil</div><p style="font-size:13px;color:#374151;line-height:1.6">${p.summary}</p></div>` : ""}
    ${exp.length ? `<div class="sec"><div class="sec-t" style="color:${brandColor}">Berufserfahrung</div>${exp.map(e => `<div class="ent"><div class="ent-t">${e.position}</div><div class="ent-s">${e.company} | ${e.start ? e.start.slice(0, 7).replace("-", "/") : ""} – ${e.current ? "heute" : (e.end ? e.end.slice(0, 7).replace("-", "/") : "")}</div><div class="ent-d">${e.description || ""}</div></div>`).join("")}</div>` : ""}
    ${edu.length ? `<div class="sec"><div class="sec-t" style="color:${brandColor}">Ausbildung</div>${edu.map(e => `<div class="ent"><div class="ent-t">${e.degree}${e.field ? " – " + e.field : ""}</div><div class="ent-s">${e.institution} | ${e.start ? e.start.slice(0, 7).replace("-", "/") : ""} – ${e.end ? e.end.slice(0, 7).replace("-", "/") : ""}</div></div>`).join("")}</div>` : ""}
  </div>
  ${isCreative ? `<div class="cv-side">
    ${skills.length ? `<div class="sec"><div class="sec-t" style="color:${brandColor}">Kenntnisse</div>${skills.map(s => `<div class="sk"><div class="sk-l"><span>${s.name}</span></div><div class="sk-b"><div class="sk-f" style="width:${s.level || 80}%"></div></div></div>`).join("")}</div>` : ""}
    ${langs.length ? `<div class="sec"><div class="sec-t" style="color:${brandColor}">Sprachen</div>${langs.map(l => `<div class="lang-row"><span>${l.language}</span><span style="color:#6b7280">${l.level}</span></div>`).join("")}</div>` : ""}
  </div>` : ""}
  </div>`;
}
