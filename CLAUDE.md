# seandobbins.com — project rules

Website for Sean Dobbins: jazz drummer, bandleader, Professor of Music (Jazz Studies) at the IU Jacobs School of Music. Two jobs: present Sean the artist and educator, and house **The Barbershop** (his teaching brand + a free, email-gated resource library that feeds MailerLite).

Owner/developer: Dana (dana@vocalsbydana.com). Sean is **not technical** and only ever edits content through the CMS at `/admin`.

## Stack

- **Astro 7** (static output) + `@astrojs/vercel` adapter. API routes under `src/pages/api/*` set `prerender = false` and run as Vercel serverless functions. Everything else is prerendered HTML.
- **Decap CMS** at `/admin` (`public/admin/`), GitHub backend, OAuth handled by `/api/auth` + `/api/callback` (no Netlify, no paid service). Saves commit straight to `main`; Vercel redeploys.
- **Content collections** in `src/content/` (`src/content.config.ts`): `resources`, `testimonials`, `outreach`, `announcements`, `settings`. Sean edits **only** these. Everything else is code.
- **MailerLite** via `src/lib/mailerlite.ts` (groups: drummers, prospective-students). **Resend** free tier for the contact form.
- **Hosting**: Vercel (Dana's account). No other paid services, no paid plugins.
- Node 22+. `npm run dev`, `npm run build` (runs `scripts/hash-pdfs.mjs` first), `npm run check`.

## Non-negotiables

1. **Sean edits only via the CMS.** Never ask him to touch code, git, Vercel or env vars. If a change needs code, Dana does it. Keep the CMS surface small: add fields only when he genuinely needs them.
2. **No ongoing costs** beyond Vercel + MailerLite free tiers. Flag anything that would add cost or create dependence on Dana.
3. **Brand is fixed.** Use `src/styles/tokens.css` and the rules below. Do not invent colors, fonts, radii or shadows.
4. **Photos are Sean working**: stage-lit, mid-laugh, mid-swing. No stock, no studio portraits. B&W for bio/press; grayscale + Stage blue wash only for text-over-photo.
5. **Bios are Sean's voice.** Edit for web, don't rewrite. The combined bio lives in `src/pages/about.astro`.
6. **Gigs come from Auralis.** `src/components/AuralisFeed.astro` is a clearly marked placeholder reading `src/data/gigs.sample.json`. Keep the boundary so the real feed drops in.
7. Mobile-first, fast, accessible: semantic HTML, focus states, `prefers-reduced-motion` respected on every animation, click-to-load YouTube.

## Brand rules (from the Brand Guidelines v1, Sept 2026)

Colors, sampled from the stage. "Blue is the room. Brass is the light."
- Ink `#0B0B14` backgrounds, body text on ivory · Stage `#12126A` section panels, photo overlays · Royal `#2D45C8` links, buttons, the one bright note · Brass `#C49A5F` rules, small type, accents only · Walnut `#5E3A1A` captions, secondary text, **error text (never red)** · Ivory `#F3EEE5` page background, text on dark · Paper `#FBF8F2` raised panels.
- Mostly ink and ivory. Brass is never more than a line, a number, or a word. Never brass text on royal; never royal on stage.

Type, three voices:
- **Bebas Neue** display: always uppercase, leading .86, never below 28px. Headlines, section titles, dates.
- **Bricolage Grotesque** text: subheads 600 set tight, body 400, labels tracked wide (.16em, uppercase, 11–12px).
- **Newsreader Italic** voice: pull quotes, press lines, the Barbershop. Italic only.

Components: square corners, hairline rules, **one royal button per screen**. 8px grid. Radius 0 everywhere except the mark. Primary button Royal on light / Ivory on dark, hover to Stage. Secondary is an outline. Links weight 600 with 1.5px brass underline, hover 2px. Event listings are hairline rows, Bebas month in Royal, day in Ink, no cards. Focus ring 2px Royal.

Marks: the ride-and-stick mark (`Mark.astro`), ring takes the type color, the stick is a brass drumstick (tapered shaft + bead tip, guide v1.1), never below 24px. The mark is drawn in four places: `Mark.astro`, `public/favicon.svg` (+ apple-touch-icon.png), and `src/lib/og.ts`; change all four together. The Barbershop badge (`BarbershopBadge.astro`) is a section marker for Barbershop-only material; stripes only inside the ring or on the pole. The pole (`Pole.astro`) sits lower in Barbershop sections, apart from the badge, never in the header, home hero, or near booking.

Voice: plain-spoken, warm, quick; sure of the craft, light on the ego. Not a press release, not a résumé. To students: invitational ("come sit in" beats "apply now").

## Email gate (resources)

- First download: modal asks name (optional) + email → `POST /api/subscribe` → MailerLite drummers group with `first_resource`/`last_resource` fields = slug → sets signed cookie `barbershop_unlocked` (2 years) → client navigates to `/api/download?slug=…`.
- `/api/download` verifies the cookie and 302s to `/files/<sha256(slug:DOWNLOAD_SECRET)[0:32]>.pdf`. Those files are staged by `scripts/hash-pdfs.mjs` from `private/resources/` at build. Cards never expose the path.
- Honeypot field + best-effort in-memory rate limit. No CAPTCHA. MailerLite's own double opt-in sends the confirmation email.
- If `MAILERLITE_API_KEY` is missing the gate still unlocks (so the site never breaks) but logs a warning and records nothing. Set the keys before launch.

## Where things live

```
src/content/          Sean's content (CMS)          src/data/            code-owned data (played-with, music, socials, Jacobs links, sample gigs)
src/pages/            routes                        src/pages/api/       serverless: subscribe, download, prospective, contact, auth, callback
src/pages/og/         build-time OG images          src/components/      UI, incl. AuralisFeed placeholder + GateModal
src/styles/tokens.css brand tokens                  src/lib/             gate, mailerlite, og, site helpers
private/resources/    PDFs uploaded by the CMS      public/uploads/      images uploaded by the CMS
public/admin/         Decap CMS                     scripts/hash-pdfs.mjs
```

Env vars: see `.env.example`. HANDOVER.md is Sean's guide to the CMS.
