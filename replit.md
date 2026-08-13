# BewerbungsKI

AI-powered German job application platform that generates professional CVs and cover letters in minutes, optimized for the German job market. Live at **https://www.bewerbungski.com** (hosted on Railway, NOT Replit Deployments).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/bewerbungski run dev` — run the React frontend
- `pnpm --filter @workspace/bewerbungski-mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/bewerbungski run build` — build frontend (required before deploying frontend changes)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Production & Deployment (IMPORTANT)

- Production runs on **Railway**, not Replit. Domain: bewerbungski.com (Strato DNS, CNAME to Railway).
- Deploy method: build frontend, tar.gz the workspace (exclude .git/node_modules/.local/.agents/attached_assets/.cache/.pythonlibs/mobile/sandbox), POST to Railway backboard `/up` endpoint with `RAILWAY_TOKEN`, poll deployment status via GraphQL. Details in `.agents/memory/railway-deploy.md`. The Railway CLI does NOT work with the token.
- Production start runs `drizzle push --force` (see `railway.json`).
- The dev workspace `ANTHROPIC_API_KEY` and the Railway one may differ — AI errors usually mean empty Anthropic credit.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind CSS, wouter routing, TanStack Query), i18n in 8 languages (de/en/es/pl/ru/tr/uk/ar incl. RTL)
- Mobile: Expo React Native (`artifacts/bewerbungski-mobile`)
- API: Express 5 (port 8080, path `/api`)
- DB: PostgreSQL + Drizzle ORM (Supabase-hosted in production)
- Auth: Supabase **email + password** (confirm-email OFF; magic link was removed 2026-08-08)
- AI: Anthropic Claude `claude-sonnet-4-5` via direct fetch (generation, LinkedIn parsing, free-text parsing)
- Payments: Stripe Checkout, one-time payment (inline `price_data`, no Price IDs)
- Analytics: Google Ads tag `AW-18372990605` + GA4 `G-0M38V4VG2D` in `index.html`, purchase conversion fires on `/?session_id=...` (Stripe success redirect)

## Pricing model (since 2026-08-13)

- 3 applications (documents) free per account, then **€9.99 one-time** for **30 more** — no subscription, nothing "unlimited".
- Enforced server-side in `artifacts/api-server/src/routes/generate.ts`: non-premium ≥3 docs → `free_limit_reached`; premium ≥33 total docs → `premium_limit_reached` (33 = 3 free + 30 purchased).
- Stripe webhook `checkout.session.completed` sets `profiles.is_premium = true`.
- When changing price/limits, update ALL of: `checkout.ts` (unit_amount + description), `generate.ts`, all 8 locale files (`pricing.premiumPrice/oneTime/premFeat1`, `home.faq1A`), `index.html` (meta + JSON-LD), the mobile app, and `routes/download.ts` info document.
- Known gap: premium users who used all 30 cannot buy another pack yet (task exists).

## Where things live

- `artifacts/bewerbungski/src/` — React frontend
  - `pages/Wizard.tsx` — 9-step wizard (personal → school → education → experience → skills → languages → job ad → template → generate); contains AI prompts, free-text ("Schnell eintippen") + LinkedIn import, `applyImport`, saved-profile banner
  - `pages/` — Home, Documents, Preview, Pricing
  - `context/AuthContext.tsx` — Supabase auth, loads `/api/me` (is_premium, documents_count)
  - `components/Layout.tsx` — nav + sidebar, free-plan progress bar (x/3)
  - `lib/buildCVHTML.ts` — 14 CV templates as HTML strings; education section BEFORE experience, both sorted chronologically ascending (school first) — user insists on this
  - `src/i18n/locales/*.json` — 8 languages, keep key sets identical
- `artifacts/api-server/src/routes/` — me, generate, documents (incl. DOCX export), checkout + webhook/stripe, parse-linkedin.ts (also hosts `/parse-freetext`), saved-profile, download.ts (public info DOCX for the owner), admin.ts
- `artifacts/api-server/src/middlewares/auth.ts` — Supabase JWT verification (service role key)
- `lib/db/src/schema/documents.ts` — `profiles` (is_premium, savedProfile jsonb), `documents`
- `lib/api-spec/` — OpenAPI spec source of truth → Orval codegen
- `.agents/memory/` — durable agent notes (deploy method, pricing, i18n decisions, Supabase pitfalls)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks
- documents_count is computed live via COUNT(*) on `documents` (no counter column); deleting documents frees quota
- AI parsing endpoints (`/parse-linkedin`, `/parse-freetext`) use temperature 0, shared rate limit (5/15min), and a `normalize()` safety net in code (e.g. regex moves school degrees from education→school) because prompt rules alone are unreliable
- CV/letter generation prompts are German-instructed; output language selectable (all 8)
- CV templates rendered as raw HTML strings for exact print fidelity

## Product & Owner context

- Owner: Raphael Halim, non-technical, German-speaking, mobile-only, very cost-sensitive — avoid unnecessary deploys/iterations, explain in simple German, no jargon.
- Users fill the wizard, AI generates CV + cover letter, documents are saved, viewable, printable, exportable as DOCX.
- Supabase free tier auto-pauses if not logged into weekly → login+checkout break. See `.agents/memory/supabase-auth.md`.

## User preferences

- All UI text in German by default (8 languages supported)
- CV must be chronological ASCENDING — school first, then education, then experience
- Brand: `--brand: #1a56db` (blue), fonts: Geist (body) + Fraunces (display)
- Dark mode via `data-theme="dark"` on `<html>`

## Required env vars

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | shared | Postgres connection |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | shared | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Verify JWTs server-side |
| `VITE_SUPABASE_ANON_KEY` | shared | Browser Supabase client |
| `ANTHROPIC_API_KEY` | secret | Claude (generation + parsing) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | secret | Stripe checkout + webhook |
| `RAILWAY_TOKEN` | secret | Production deploys (backboard API only) |
| `SESSION_SECRET` | secret | Express session |

## Gotchas

- Run `pnpm --filter @workspace/db run push` after any schema change; codegen after OpenAPI edits
- Vite dev server uses `PORT` env var — don't hardcode ports
- `setAuthTokenGetter` must be called in AuthContext after each session change
- `/api/download/RaphaelKI2026` is a public unauthenticated DOCX with owner info — securing it is an open task (#32)
- Long shell polls (deploy status) may be cancelled client-side — log the deployment ID first, poll separately

## Pointers

- See the `pnpm-workspace` skill for workspace structure details
- See `.agents/memory/MEMORY.md` for durable operational lessons (deploy, DNS, Supabase, pricing)
