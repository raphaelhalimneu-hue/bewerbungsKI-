---
name: Supabase auth outage risk
description: BewerbungsKI login/purchase depends on a free-tier Supabase project that auto-pauses; how to detect and fix.
---

- Auth and Stripe checkout depend on the user's free-tier Supabase project (`bsdfaidadvdojyeiqcqj.supabase.co`, hardcoded fallback in the web app's supabase client). Free tier auto-pauses after ~1 week of dashboard inactivity → login silently stops, nobody can buy.
- **Auth method (since 2026-08-08): email + password** (signInWithPassword/signUp), NOT magic link anymore. "Confirm email" is DISABLED in Supabase (Sign In / Providers → User Signups) because free-tier SMTP (~3 mails/h) never reached real users. Signup returns a session immediately.
- **Detection:** domain returns NXDOMAIN when paused; after restore serves 521 for minutes, then works. Health test: POST `/auth/v1/token?grant_type=password` with test creds.
- **Fix:** only the user can restore at supabase.com/dashboard ("Resume project", free). He has TWO projects; app uses "Projekt von raphaelhalimneu@gmail.com", NOT "bewerbungsKI".
- User told to log into supabase.com weekly. He declined an agent task for health checks (2026-08-07).
- Test account: agent-check-1786@gmail.com / Testpass!2026agent. Correct anon key is the one hardcoded in artifacts/bewerbungski/src/lib/supabase.ts (iat 1777480304) — an older key circulating in notes is invalid.
