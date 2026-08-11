import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import tr from "./locales/tr.json";
import ar from "./locales/ar.json";
import uk from "./locales/uk.json";
import ru from "./locales/ru.json";
import pl from "./locales/pl.json";

import { LANGUAGES } from "./languages";
import { pathWithoutLang, pathForLang } from "../lib/basePath";

export { LANGUAGES };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      es: { translation: es },
      tr: { translation: tr },
      ar: { translation: ar },
      uk: { translation: uk },
      ru: { translation: ru },
      pl: { translation: pl },
    },
    fallbackLng: "de",
    supportedLngs: LANGUAGES.map(l => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

const CANONICAL_ORIGIN = "https://www.bewerbungski.com";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function applyLocaleHead(lng: string) {
  const rtl = LANGUAGES.find(l => l.code === lng)?.rtl === true;
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  document.documentElement.lang = lng;

  // Localized title + description
  const title = i18n.t("seo.title");
  const desc = i18n.t("seo.description");
  document.title = title;
  upsertMeta("name", "description", desc);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", desc);
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", desc);

  // hreflang alternates + canonical for the current page.
  // German lives at the root; other languages under /<code>.
  const rest = pathWithoutLang();

  document.head.querySelectorAll('link[rel="alternate"][hreflang], link[rel="canonical"]').forEach(el => el.remove());

  const urlFor = (code: string) => CANONICAL_ORIGIN + pathForLang(code, rest);

  for (const l of LANGUAGES) {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = l.code;
    link.href = urlFor(l.code);
    document.head.appendChild(link);
  }
  const xDefault = document.createElement("link");
  xDefault.rel = "alternate";
  xDefault.hreflang = "x-default";
  xDefault.href = urlFor("de");
  document.head.appendChild(xDefault);

  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = urlFor(lng);
  document.head.appendChild(canonical);
}

/** Re-apply title/canonical/hreflang for the current URL and language. */
export function updateLocaleHead() {
  applyLocaleHead(i18n.resolvedLanguage || "de");
}

updateLocaleHead();
i18n.on("languageChanged", applyLocaleHead);

export default i18n;
