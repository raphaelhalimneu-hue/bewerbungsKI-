---
name: Supabase auth outage risk
description: BewerbungsKI login/purchase depends on a free-tier Supabase project that auto-pauses; how to detect and fix.
---

- Auth (magic-link emails) and therefore Stripe checkout depend on the user's free-tier Supabase project (`bsdfaidadvdojyeiqcqj.supabase.co`, hardcoded fallback in the web app's supabase client). Free tier auto-pauses after ~1 week of dashboard inactivity → login emails silently stop, nobody can buy.
- **Detection:** the domain returns NXDOMAIN when paused; after restore it serves 521 for several minutes while booting, then works. Test with a POST to `/auth/v1/otp` (a fake email getting `email_address_invalid` = service healthy).
- **Fix:** only the user can restore it at supabase.com/dashboard ("Resume project", free). Note: his dashboard auto-translates the button to "Lebenslaufprojekt". He has TWO projects; the app uses the one named "Projekt von raphaelhalimneu@gmail.com", NOT the one named "bewerbungsKI".
- User was told to log into supabase.com weekly to keep it awake. He declined an agent task to add health checks (2026-08-07).
