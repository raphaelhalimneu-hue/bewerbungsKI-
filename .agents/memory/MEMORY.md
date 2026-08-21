# Memory Index

- [Supabase auth outage risk](supabase-auth.md) — free-tier project auto-pauses and kills login+checkout; auth is now email+password with confirm-email OFF (magic link removed 2026-08-08).

- [BewerbungsKI i18n decisions](i18n-decisions.md) — UI in 8 languages incl. RTL Arabic; applications default to German but language is selectable (all 8) since 2026-08-11; AI prompts stay German-instructed.
- [Railway deploy method](railway-deploy.md) — tar-ball upload via backboard GraphQL API; multipart and CLI do NOT work with the workspace token.
- [Custom domain bewerbungski.com](custom-domain.md) — www uses Strato CNAME + Railway TXT verification; apex depends on Strato HTTPS redirect and can fail separately.
- [AI provider](groq-provider.md) — generation runs on Claude (claude-sonnet-4-5) since 2026-08-11; errors usually mean empty Anthropic credit.
- [Pricing model](pricing-model.md) — eine kostenlose Bewerbung, danach alle App-Funktionen serverseitig gesperrt bis zum Kauf; 9,99 € einmalig für 10 weitere.
- [Briefkopf-Vorlagen](letterhead-templates.md) — 19 user-designte PNG-Briefköpfe ersetzen die alte 14er-Auswahl (2026-08-17); alte IDs bleiben für Bestandsdokumente renderbar; PDF-Puppeteer erlaubt nur /letterheads/*.png von Disk.
- [DOCX/PDF-Export-Fallstricke](docx-export-quirks.md) — DOCX: nur DXA-Tabellenbreiten + cleanText für Unicode-Spaces (Mobile-Viewer); PDF: CSS-zoom vor html2canvas auf 1.
- [Features Aug 2026](features-overview.md) — profil-save (savedProfile jsonb), inline-edit (contentEditable CV + textarea letter), DOCX export (/api/documents/:id/download/cv.docx + cover-letter.docx), Mobile Expo app.
- [Perfektionierungs-Vorschau](perfected-preview-gating.md) — Gratis-Nutzer erhalten nur serverseitig gekürzte Vorschauen; Volltexte bleiben generation-gebunden bis zum Kauf.
- [Kontofreigaben](account-access-exceptions.md) — Keine fest eingebauten E-Mail-Ausnahmen: Sonderzugriff nur über die explizite Server-Allowlist.
