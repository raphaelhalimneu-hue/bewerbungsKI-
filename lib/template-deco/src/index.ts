/**
 * Gemeinsame dekorative Hintergrund-Layer für CV-Vorlagen UND Anschreiben.
 * Einzige Quelle der Wahrheit — importiert von der Web-App
 * (`artifacts/bewerbungski`) und dem API-Server (`artifacts/api-server`),
 * damit CV- und Anschreiben-Design nicht auseinanderlaufen können.
 *
 * html2canvas-/PDF-sicher: nur statische divs mit Gradients und border-radius,
 * keine externen Ressourcen. Alle Layer liegen mit z-index:-1 hinter dem Text.
 */

/** Alle bekannten Vorlagen-IDs. `DECO` ist als Record über diese IDs typisiert,
 *  daher erzwingt der Compiler, dass jede Vorlage einen Deko-Eintrag hat. */
export const TEMPLATE_IDS = [
  "modern", "classic", "creative", "executive", "minimal", "elegant", "bold",
  "compact", "swiss", "nordic", "corporate", "timeline", "slate", "terra", "custom",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

const DA = "position:absolute;z-index:-1;pointer-events:none;";

export const DECO: Record<TemplateId, string> = {
  modern: `<div style="${DA}top:0;left:0;right:0;height:10px;background:linear-gradient(90deg,#111827 0%,#374151 55%,#9ca3af 100%);"></div><div style="${DA}top:-110px;right:-110px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(17,24,39,.06),rgba(17,24,39,0) 70%);"></div>`,
  classic: `<div style="${DA}top:-90px;right:-90px;width:260px;height:260px;border-radius:50%;border:30px solid #f1f5f9;"></div><div style="${DA}bottom:-70px;left:-70px;width:180px;height:180px;border-radius:50%;border:20px solid #f8fafc;"></div>`,
  creative: `<div style="${DA}top:-80px;right:-80px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(30,58,95,.09),rgba(30,58,95,0) 70%);"></div>`,
  executive: `<div style="${DA}top:12px;left:12px;right:12px;bottom:12px;border:1px solid #e2e8f0;"></div><div style="${DA}top:12px;left:12px;width:70px;height:70px;border-top:3px solid #1f2937;border-left:3px solid #1f2937;"></div><div style="${DA}bottom:12px;right:12px;width:70px;height:70px;border-bottom:3px solid #1f2937;border-right:3px solid #1f2937;"></div>`,
  minimal: `<div style="${DA}top:-120px;right:-120px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle at 35% 35%,rgba(243,244,246,.9),rgba(243,244,246,0) 70%);"></div>`,
  elegant: `<div style="${DA}top:-130px;left:-90px;width:520px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(191,219,254,.45),rgba(191,219,254,0) 68%);"></div><div style="${DA}top:-70px;left:210px;width:420px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(226,232,240,.6),rgba(226,232,240,0) 68%);"></div><div style="${DA}bottom:-150px;right:-130px;width:460px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(254,243,199,.55),rgba(254,243,199,0) 68%);"></div>`,
  bold: `<div style="${DA}bottom:-90px;left:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(15,23,42,.07),rgba(15,23,42,0) 70%);"></div>`,
  compact: `<div style="${DA}top:0;left:0;width:7px;height:100%;background:linear-gradient(180deg,#f59e0b 0%,#f59e0b 12%,#10b981 12%,#10b981 28%,#3b82f6 28%,#3b82f6 46%,#ef4444 46%,#ef4444 60%,#8b5cf6 60%,#8b5cf6 76%,#f472b6 76%,#f472b6 100%);"></div>`,
  swiss: `<div style="${DA}top:-80px;right:-80px;width:220px;height:220px;border-radius:50%;border:24px solid #fef2f2;"></div><div style="${DA}top:44px;right:44px;width:14px;height:14px;border-radius:50%;background:#dc2626;"></div>`,
  nordic: `<div style="${DA}top:-110px;left:-130px;width:400px;height:310px;border-radius:48% 52% 60% 40%/55% 45% 60% 40%;background:linear-gradient(135deg,rgba(13,148,136,.15),rgba(52,211,153,.06));"></div><div style="${DA}bottom:-130px;right:-110px;width:360px;height:290px;border-radius:55% 45% 40% 60%/45% 55% 40% 60%;background:linear-gradient(315deg,rgba(13,148,136,.11),rgba(52,211,153,.05));"></div>`,
  corporate: `<div style="${DA}top:-80px;right:-80px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.10),rgba(16,185,129,0) 70%);"></div>`,
  timeline: `<div style="${DA}top:-130px;right:-130px;width:320px;height:320px;border-radius:50%;border:36px solid #fff7ed;"></div><div style="${DA}bottom:-90px;left:-90px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(234,88,12,.07),rgba(234,88,12,0) 70%);"></div>`,
  slate: `<div style="${DA}bottom:-110px;right:-100px;width:320px;height:270px;border-radius:60% 40% 55% 45%/50% 60% 40% 50%;background:linear-gradient(135deg,rgba(99,102,241,.13),rgba(148,163,184,.09));"></div><div style="${DA}bottom:150px;right:40px;width:16px;height:16px;border-radius:50%;background:rgba(99,102,241,.35);"></div>`,
  custom: ``, // custom template draws its own accent bar inline
  terra: `<div style="${DA}top:-50px;left:-70px;width:360px;height:210px;background:repeating-linear-gradient(115deg,rgba(254,215,170,.55) 0 14px,rgba(254,215,170,0) 14px 34px);transform:rotate(-8deg);"></div><div style="${DA}bottom:-40px;right:-60px;width:320px;height:180px;background:repeating-linear-gradient(115deg,rgba(251,207,232,.45) 0 12px,rgba(251,207,232,0) 12px 30px);transform:rotate(-8deg);"></div>`,
};

/**
 * Liefert die Deko-Layer zur Vorlage — leerer String, falls unbekannt.
 * Für "custom" wird eine Akzentleiste in der Nutzerfarbe erzeugt (nur Hex erlaubt).
 * Wird für Anschreiben (Web-Vorschau + serverseitige PDF) verwendet.
 */
export function templateDeco(template: string | null | undefined, customAccent?: unknown): string {
  if (template === "custom") {
    const acc = typeof customAccent === "string" && /^#[0-9a-fA-F]{3,8}$/.test(customAccent) ? customAccent : "#1f2937";
    return `<div style="${DA}top:0;left:0;right:0;height:10px;background:${acc};"></div>`;
  }
  return (template && DECO[template as TemplateId]) || "";
}
