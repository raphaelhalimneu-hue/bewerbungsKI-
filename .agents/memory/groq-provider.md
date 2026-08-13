---
name: AI provider for generation
description: Which AI generates the applications and billing caveats
---
- Since 2026-08-11 generation runs on Anthropic Claude (`claude-sonnet-4-5`) via api.anthropic.com in artifacts/api-server/src/routes/generate.ts. Groq was replaced because the user found llama-3.3-70b output quality too poor.
- **Why:** paid API — key lives in Railway env `ANTHROPIC_API_KEY` (account raphaelhalimneu@gmail.com). If generation returns errors, first suspect empty Anthropic credit balance ("credit balance is too low"). User must top up at console.anthropic.com.
- User once pasted an API key in chat (2026-08-11); advised to keep keys private.
- GROQ_API_KEY still set on Railway but unused.

- Der ANTHROPIC_API_KEY im Replit-Dev-Workspace ist UNGÜLTIG (invalid x-api-key); nur der Key in den Railway-Env-Vars funktioniert. KI-Features daher immer auf Production testen, nicht lokal.
