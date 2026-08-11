---
name: BewerbungsKI i18n decisions
description: Multilingual UI decisions for the bewerbungski app (8 languages, RTL, German output)
---

- UI is translated into 8 languages (de default, en, es, tr, ar, uk, ru, pl) via react-i18next; language detection localStorage→navigator, persisted in localStorage.
- **Generated documents default to German, but since 2026-08-11 the user picks the document language** (all 8) via a dropdown in the wizard's last step; the AI prompt instructions themselves stay German, only the output language is switched.
- Arabic is RTL: `document.documentElement.dir` is set on language change; use logical CSS (border-e, insetInlineEnd) instead of physical left/right in components.
- Google Search Console ownership is verified via the file `public/google585f8e7f9ac4ca9d.html` — never delete it, or verification is lost.
- SEO: each language has its own URL (German = root, others under /<code>); URL prefix is authoritative and overrides stored/browser language; non-German detected visitors at root get a client redirect to their prefix. hreflang/canonical are managed in the document head and re-applied on route changes; sitemap.xml + robots.txt live in public/.
- Locale files live in `src/i18n/locales/*.json`; all must keep the identical key set as de.json (source of truth).
- **Why:** user wants reach among non-German-speaking job seekers in Germany; output language German is the selling point.
