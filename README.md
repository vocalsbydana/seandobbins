# seandobbins.com

Website for jazz drummer and educator Sean Dobbins, home of The Barbershop. Astro 7 on Vercel, with a built-in password-protected editor at `/admin` that commits to this repository through the GitHub API. MailerLite powers the resource library's email gate.

- `CLAUDE.md` — stack, brand rules, constraints, and the "Sean edits only via the editor" principle.
- `HANDOVER.md` — Sean's guide to the editor, plus Dana's setup notes.
- `.env.example` — every environment variable the site uses.

```
npm install
npm run dev      # ADMIN_STORE=local ADMIN_PASSWORD=... in .env to use the editor locally
npm run build
```
