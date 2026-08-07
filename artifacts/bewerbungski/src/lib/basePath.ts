import { LANGUAGES } from "../i18n/languages";

/** App base path without trailing slash, e.g. "" or "/bewerbungski". */
export const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");

const LANG_CODES = LANGUAGES.map(l => l.code);

/** Current pathname relative to the app base, always starting with "/". */
export function appPath(): string {
  const p = window.location.pathname;
  const rel = p.startsWith(appBase) ? p.slice(appBase.length) : p;
  return rel || "/";
}

/** Language prefix in the app-relative path, or null (German lives at the root). */
export function pathLang(path: string = appPath()): string | null {
  const seg = path.split("/")[1];
  return seg && seg !== "de" && LANG_CODES.includes(seg) ? seg : null;
}

/** App-relative path with any language prefix removed. */
export function pathWithoutLang(path: string = appPath()): string {
  const lang = pathLang(path);
  if (!lang) return path;
  return path.slice(lang.length + 1) || "/";
}

/** App-relative path for the given language (German = no prefix). */
export function pathForLang(code: string, rest: string = pathWithoutLang()): string {
  return code === "de" ? rest : `/${code}${rest === "/" ? "" : rest}`;
}
