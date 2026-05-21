# BewerbungsKI

AI-powered German job application platform that generates professional CVs and cover letters in minutes, optimized for the German job market.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/bewerbungski run dev` — run the React frontend (port 24163)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind CSS, wouter routing, TanStack Query)
- API: Express 5 (port 8080, path `/api`)
- DB: PostgreSQL + Drizzle ORM
- Auth: Supabase magic-link (no password)
- AI: Anthropic Claude (CV + cover letter generation)
- Payments: Stripe checkout (€9.90 one-time lifetime premium)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/bewerbungski/src/` — React frontend
  - `pages/` — Home, Wizard, Documents, Preview, Pricing
  - `context/` — AuthContext (Supabase), ThemeContext (dark/light)
  - `components/Layout.tsx` — Nav + Sidebar shell
  - `components/AuthModal.tsx` — Magic link sign-in dialog
  - `lib/buildCVHTML.ts` — CV template renderer (modern/classic/creative)
  - `lib/supabase.ts` — Supabase client
- `artifacts/api-server/src/routes/` — Express routes: me, generate, documents, checkout, webhook/stripe
- `artifacts/api-server/src/middlewares/auth.ts` — Supabase JWT verification
- `lib/db/src/schema/documents.ts` — DB schema: `profiles`, `documents`
- `lib/api-client-react/src/generated/api.ts` — Generated React Query hooks
- `lib/api-spec/` — OpenAPI spec source of truth

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks
- Supabase magic-link auth: no passwords, frontend obtains JWT, passes to API as Bearer token
- Free plan: 1 document per user; Premium (€9.90 one-time) unlocks unlimited via Stripe checkout
- CV templates rendered as raw HTML strings (injected via `dangerouslySetInnerHTML`) for exact print fidelity
- All German UI text, optimized for DACH job market conventions (DIN-style CVs)

## Product

BewerbungsKI helps German job seekers create tailored CVs and cover letters using Claude AI. Users fill an 8-step wizard (personal data, experience, education, skills, languages, job ad, template, generate), the AI generates professional German documents, and they're saved to the user's account for viewing and printing.

## User preferences

- All UI text in German
- Brand: `--brand: #1a56db` (blue), fonts: Geist (body) + Fraunces (display)
- Dark mode supported via `data-theme="dark"` on `<html>`

## Required env vars

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | shared | Postgres connection |
| `SUPABASE_URL` | shared | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Verify JWTs server-side |
| `VITE_SUPABASE_URL` | shared | Supabase URL for browser |
| `VITE_SUPABASE_ANON_KEY` | shared | Supabase anon key for browser |
| `ANTHROPIC_API_KEY` | secret | Claude AI generation |
| `STRIPE_SECRET_KEY` | secret | Stripe checkout |
| `VITE_STRIPE_PUBLISHABLE_KEY` | shared | Stripe frontend |
| `SESSION_SECRET` | secret | Express session |

## Gotchas

- Run `pnpm --filter @workspace/db run push` after any schema change
- Run `pnpm --filter @workspace/api-spec run codegen` after editing the OpenAPI spec
- The Vite dev server uses `PORT` env var — don't hardcode port in vite.config.ts
- `setAuthTokenGetter` must be called in AuthContext after each session change to wire auth into API calls

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
