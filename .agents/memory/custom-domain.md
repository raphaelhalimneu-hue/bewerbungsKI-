---
name: Custom domain bewerbungski.com
description: Strato DNS + Railway custom domain setup and cert quirks
---
- www.bewerbungski.com = CNAME at Strato → Railway custom domain target (current: 4fzlvytf.up.railway.app). Root domain uses Strato "Umleitung Extern" 301 → https://www.bewerbungski.com/ (Strato can't CNAME the root).
- **Why:** Railway needs only a CNAME — no TXT record, despite what other tools told the user.
- If a Railway cert is stuck in VALIDATING_OWNERSHIP for hours with correct DNS, delete + recreate the custom domain via GraphQL (customDomainDelete/customDomainCreate). Each recreate generates a NEW random target value → user must update Strato again, so avoid unless truly stuck. Repeated attempts can hit Let's Encrypt rate limits (slower issuance).
- **How to apply:** check status via `domains(...){customDomains{status{dnsRecords{currentValue requiredValue}certificateStatus}}}` on backboard.railway.com/graphql/v2.
