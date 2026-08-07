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

export const LANGUAGES: { code: string; label: string; flag: string; rtl?: boolean }[] = [
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦", rtl: true },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
];

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

function applyDirection(lng: string) {
  const rtl = LANGUAGES.find(l => l.code === lng)?.rtl === true;
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  document.documentElement.lang = lng;
}

applyDirection(i18n.resolvedLanguage || "de");
i18n.on("languageChanged", applyDirection);

export default i18n;
