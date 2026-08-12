---
name: BewerbungsKI Feature Overview
description: Durable decisions for the 3 major features added in Aug 2026
---

## Profil speichern (Feature 1)
- `savedProfile` jsonb column added to `profilesTable` (Drizzle push on server start handles migration automatically)
- Routes: GET/PUT `/api/saved-profile` in `artifacts/api-server/src/routes/profile.ts`
- Web Wizard: auto-saves personal/exp/edu/skills/lang after every successful generation; shows "Gespeichertes Profil verfügbar" banner at Step 0 with "Jetzt laden" button
- i18n keys: `wizard.profileLoaded`, `wizard.savedProfileAvailable`, `wizard.loadProfile` — all 8 locales

## Inline-Bearbeitung (Feature 2)
- CV: contentEditable div (innerHTML set via useEffect + ref); html2canvas captures DOM edits → PDF reflects edits
- Cover Letter: `<textarea>` with `editedLetter` state initialized from `doc.cover_letter`
- Both PDF exports use the live edited content
- DOCX export also reflects cover letter edits (passes `?text=` query param to server)
- i18n keys: `preview.editLetterHint`, `preview.editCvHint` — all 8 locales

## DOCX Export (Feature added with mobile request)
- Routes: GET `/api/documents/:id/download/cv.docx` and `/api/documents/:id/download/cover-letter.docx`
- CV DOCX built from `profileData` JSON (not HTML) using the `docx` npm package (already in deps)
- Cover letter DOCX accepts `?text=<encoded>` query param for edited content
- Preview.tsx: "⬇ CV .docx" + "⬇ Anschreiben .docx" buttons using `customFetch` with blob responseType

## Mobile App (Feature 3)
- Expo artifact at `artifacts/bewerbungski-mobile`; workflow: `artifacts/bewerbungski-mobile: expo`
- Auth: `@supabase/supabase-js` with AsyncStorage persistence; `setAuthTokenGetter` from api-client-react
- Base URL: `setBaseUrl("https://bewerbungski.com")` — same Railway backend as web
- 3 tabs: Erstellen (wizard), Dokumente (list + modal preview), Konto (profile + upgrade + sign out)
- Wizard: 5 steps — Personal, Erfahrung, Ausbildung, Kenntnisse/Sprachen, Stellenanzeige/Generieren
- Same generate API calls as web; navigates to documents tab on success

## Windows
- No separate app needed: bewerbungski.com works in any Windows browser (Chrome, Edge, Firefox)
