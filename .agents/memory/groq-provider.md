---
name: AI provider is Groq (free tier)
description: Generation switched from Anthropic to Groq because user cannot/will not pay for API credit.
---

- `/api/generate` calls Groq chat-completions (`llama-3.3-70b-versatile`) via plain fetch; env var `GROQ_API_KEY` set on Railway (user's free console.groq.com account). Switched 2026-08-08.
- **Why:** both Anthropic keys fail with "credit balance too low"; user refuses to buy credit. Groq free tier needs no card.
- **How to apply:** if generation 500s, check Railway logs for Groq errors; Groq periodically decommissions models (llama-3.1-70b-versatile already gone) — list live models via `GET /openai/v1/models` and swap the model name.
- Anthropic SDK still in api-server package.json (unused); Replit secrets ANTHROPIC_API_KEY/ANTHROPI_API_KEY are dead weight.
