---
name: BewerbungsKI i18n decisions
description: Multilingual UI decisions for the bewerbungski app (8 languages, RTL, German output)
---

- UI is translated into 8 languages (de default, en, es, tr, ar, uk, ru, pl) via react-i18next; language detection localStorage→navigator, persisted in localStorage.
- **Generated documents (CV/cover letter) stay German** — German job market is the product. The AI prompts in the wizard must NOT be translated. A hint (`home.germanNote`) tells non-German UI users about this.
- Arabic is RTL: `document.documentElement.dir` is set on language change; use logical CSS (border-e, insetInlineEnd) instead of physical left/right in components.
- Locale files live in `src/i18n/locales/*.json`; all must keep the identical key set as de.json (source of truth).
- **Why:** user wants reach among non-German-speaking job seekers in Germany; output language German is the selling point.
