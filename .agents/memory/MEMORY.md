# Memory Index

- [Supabase auth outage risk](supabase-auth.md) — free-tier project auto-pauses and kills login+checkout; auth is now email+password with confirm-email OFF (magic link removed 2026-08-08).

- [BewerbungsKI i18n decisions](i18n-decisions.md) — UI in 8 languages incl. RTL Arabic; generated applications and AI prompts stay German by design.
- [Railway deploy method](railway-deploy.md) — tar-ball upload via backboard GraphQL API; multipart and CLI do NOT work with the workspace token.
- [Custom domain bewerbungski.com](custom-domain.md) — Strato CNAME only (no TXT); stuck Railway certs fixed by delete+recreate, which changes the CNAME target.
- [AI provider](groq-provider.md) — generation runs on Claude (claude-sonnet-4-5) since 2026-08-11; errors usually mean empty Anthropic credit.
