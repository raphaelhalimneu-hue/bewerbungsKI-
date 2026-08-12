import type { FormData } from "./buildCVHTML";

export type AtsResult = {
  score: number;          // 0-100
  keywordScore: number;   // 0-100
  sectionScore: number;   // 0-100
  matched: string[];
  missing: string[];
};

const STOPWORDS = new Set([
  // German
  "und", "oder", "der", "die", "das", "ein", "eine", "einen", "einem", "einer", "mit", "für", "von", "auf", "bei", "aus", "als", "wir", "sie", "ihr", "ihre", "unsere", "unser", "dich", "sich", "auch", "sind", "ist", "wird", "werden", "haben", "hat", "kann", "können", "sowie", "über", "nach", "durch", "zum", "zur", "des", "den", "dem", "uns", "ins", "im", "am", "an", "in", "zu", "es", "um", "so", "dass", "wenn", "mehr", "sehr", "gerne", "bitte", "bereich", "aufgaben", "profil", "bieten", "suchen", "arbeiten", "team", "teams", "unternehmen", "stelle", "position", "erfahrung", "kenntnisse", "gute", "guten", "gutes", "hohe", "hohen", "neue", "neuen", "jahre", "jahren", "abgeschlossene", "abgeschlossenes", "idealerweise", "wünschenswert", "vorteil", "bewerbung", "bewerben",
  // English
  "and", "or", "the", "a", "an", "with", "for", "of", "on", "at", "from", "as", "we", "you", "your", "our", "is", "are", "will", "be", "have", "has", "can", "to", "in", "it", "that", "this", "more", "very", "team", "company", "role", "position", "experience", "skills", "work", "working", "years", "plus", "strong", "good", "great", "about", "join", "looking",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zäöüßáéíóúñçğışа-яїієґ0-9+#.\-]{3,}/gi) || [])
    .map(t => t.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Client-side ATS score: keyword match between job ad and CV (60%)
 * plus a completeness check of standard CV sections (40%).
 */
export function computeAtsScore(form: FormData, cvHtml: string): AtsResult | null {
  const jobText = `${form.jobad.title} ${form.jobad.description}`.trim();
  const cvText = (cvHtml || "").replace(/<[^>]+>/g, " ").toLowerCase()
    + " " + form.skills.map(s => s.name).join(" ").toLowerCase();

  // ── Keyword match (60%) ──
  let keywordScore = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  if (jobText.length > 30) {
    const freq = new Map<string, number>();
    for (const tok of tokenize(jobText)) freq.set(tok, (freq.get(tok) || 0) + 1);
    const keywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([k]) => k);
    if (keywords.length === 0) return null;
    for (const kw of keywords) {
      if (cvText.includes(kw)) matched.push(kw);
      else missing.push(kw);
    }
    keywordScore = Math.round((matched.length / keywords.length) * 100);
  } else {
    return null; // no job ad → no meaningful ATS score
  }

  // ── Section completeness (40%) ──
  const checks = [
    !!(form.personal.email && form.personal.phone),          // contact data
    !!form.personal.summary || /profil|profile|summary/i.test(cvHtml), // profile section
    form.experience.length > 0,                              // experience
    form.education.length > 0,                               // education
    form.skills.length >= 3,                                 // skills
    form.languages.length > 0,                               // languages
    form.experience.some(e => (e.description || "").length > 40), // detailed descriptions
    !!form.personal.title,                                   // job title
  ];
  const sectionScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const score = Math.round(keywordScore * 0.6 + sectionScore * 0.4);
  return { score, keywordScore, sectionScore, matched: matched.slice(0, 12), missing: missing.slice(0, 8) };
}
