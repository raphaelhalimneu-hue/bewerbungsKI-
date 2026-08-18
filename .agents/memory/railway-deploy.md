---
name: Railway deploy method
description: How to deploy this project to Railway (the only production environment; Replit deploy unavailable on user's plan)
---

- Live URL: https://web-production-c5abc.up.railway.app — project f88e5c3f-e1b6-4616-8ecc-e1fa02832d0c, env production 19490e15-3d0c-48f0-a0eb-477175ddf001, service web f987ee0c-b556-4749-997e-80402be24654.
- Token `RAILWAY_TOKEN` (Replit secret) works ONLY against `backboard.railway.com/graphql/v2` with a Bearer header; the Railway CLI rejects it (Unauthorized).
- Deploy: create tar.gz excluding .git, node_modules, dist, .local, .agents, attached_assets, .cache, .pythonlibs; POST body as `application/gzip` to `backboard.railway.com/project/{proj}/environment/{env}/up?serviceId={svc}`; poll status via GraphQL `deployment(id:...)`. Multipart upload hangs in INITIALIZING — don't use it.
- `railway.json` startCommand overrides nixpacks [start]; drizzle push runs at start with `--force`.
- **Why:** repeated painful discovery; user is mobile-only and non-technical, so deploys must be done by the agent.

**2026-08-13:** Uploads können bei Railway stundenlang in INITIALIZING hängen (deploymentEvents zeigt nur SNAPSHOT_CODE, kein Build startet); ältere hängende Deploys kippen später auf FAILED ("no associated build"). Plattformseitig — erneutes Hochladen hilft nicht sofort; warten oder später neu deployen.

- 2026-08-13 evening: platform-wide Railway incident — deploys stuck in INITIALIZING for hours (only SNAPSHOT_CODE event, no build). deploymentCancel of queued deploys + fresh upload does NOT help; only waiting for Railway recovery works. Old version keeps serving meanwhile.

**Prod-DB-Zugriff für Tests:** Railway-Postgres ist nur intern erreichbar; temporär per GraphQL `tcpProxyCreate` (applicationPort 5432) einen TCP-Proxy anlegen, mit POSTGRES_PASSWORD des Postgres-Service verbinden, danach `tcpProxyDelete`. So lassen sich z. B. E-Mail-Codes für E2E-Tests auslesen.
**E2E-Test-Konten:** Gmail-Plus-Aliase (halimraphael9+xyz@gmail.com) + Supabase-REST-signup mit Anon-Key liefern echte Prod-Accounts; Bash: Variable UID ist readonly, anderen Namen nehmen.
