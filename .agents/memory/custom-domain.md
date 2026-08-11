---
name: Custom domain bewerbungski.com
description: Strato DNS + Railway custom domain setup and cert quirks
---
- www.bewerbungski.com = CNAME at Strato → Railway custom domain target (current: 4fzlvytf.up.railway.app). Root domain uses Strato "Umleitung Extern" 301 → https://www.bewerbungski.com/ (Strato can't CNAME the root).
- **Why (corrected 2026-08-11):** Railway now ALSO requires a TXT record `_railway-verify.<hostname>` containing the `verificationToken` from the domain status API — cert stays in VALIDATING_OWNERSHIP forever without it. The user was right; earlier "CNAME only" advice was wrong.
- If a Railway cert is stuck in VALIDATING_OWNERSHIP for hours with correct DNS, delete + recreate the custom domain via GraphQL (customDomainDelete/customDomainCreate). Each recreate generates a NEW random target value → user must update Strato again, so avoid unless truly stuck. Repeated attempts can hit Let's Encrypt rate limits (slower issuance).
- **How to apply:** check status via `domains(...){customDomains{status{dnsRecords{currentValue requiredValue}certificateStatus}}}` on backboard.railway.com/graphql/v2.
