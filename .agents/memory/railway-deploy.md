---
name: Railway deploy method
description: How to deploy this project to Railway (the only production environment; Replit deploy unavailable on user's plan)
---

- Live URL: https://web-production-c5abc.up.railway.app — project f88e5c3f-e1b6-4616-8ecc-e1fa02832d0c, env production 19490e15-3d0c-48f0-a0eb-477175ddf001, service web f987ee0c-b556-4749-997e-80402be24654.
- Token `RAILWAY_TOKEN` (Replit secret) works ONLY against `backboard.railway.com/graphql/v2` with a Bearer header; the Railway CLI rejects it (Unauthorized).
- Deploy: create tar.gz excluding .git, node_modules, dist, .local, .agents, attached_assets, .cache, .pythonlibs; POST body as `application/gzip` to `backboard.railway.com/project/{proj}/environment/{env}/up?serviceId={svc}`; poll status via GraphQL `deployment(id:...)`. Multipart upload hangs in INITIALIZING — don't use it.
- `railway.json` startCommand overrides nixpacks [start]; drizzle push runs at start with `--force`.
- **Why:** repeated painful discovery; user is mobile-only and non-technical, so deploys must be done by the agent.
