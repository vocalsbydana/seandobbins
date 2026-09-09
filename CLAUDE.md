# seandobbins.com — project rules

Website for Sean Dobbins: jazz drummer, bandleader, Professor of Music (Jazz Studies) at the IU Jacobs School of Music. Two jobs: present Sean the artist and educator, and house **The Barbershop** (his teaching brand + a free, email-gated resource library that feeds MailerLite).

Owner/developer: Dana (dana@vocalsbydana.com). Sean is **not technical** and only ever edits content through the site's own editor at `/admin`.

## Stack

- **Astro 7** (static output) + `@astrojs/vercel` adapter. API routes under `src/pages/api/*` set `prerender = false` and run as Vercel serverless functions. Everything else is prerendered HTML.
- **In-site editor** at `/admin` (`src/pages/admin.astro`, `src/lib/admin/*`, `src/pages/api/admin/*`). Password login (`ADMIN_PASSWORD`), session is an HMAC cookie. The repository is the database: every save is a commit through the GitHub API (`GITHUB_TOKEN`, fine-grained, contents RW on this repo) to the branch the deployment was built from; Vercel rebuilds. The editor then polls the live site's `<meta name="build-commit">` and reports committed → building → live honestly. In `astro dev` with `ADMIN_STORE=local` it edits the working tree instead.
- **Editable content** = files under `src/content/`: collections `resources`, `testimonials`, `outreach`, `announcements` (markdown + frontmatter, `src/content.config.ts`) and **page copy** `src/content/copy/<page>.json`. Sean edits **only** these, via the editor. Everything else is code.
- **Page copy convention**: every visible string on a page lives in its page's JSON and is rendered through `<T k="page.section.key" />` (`src/components/T.astro`) or an element carrying `data-edit="page.section.key"`. That attribute is how the editor's live preview finds text to update and how click-to-edit locates the field. When adding text to a page, add it to the JSON and tag it; never hard-code visible copy in a template.
- **MailerLite** via `src/lib/mailerlite.ts` (groups: drummers, prospective-students). **Resend** free tier for the contact form.
- **Hosting**: Vercel (Dana's account). No other paid services, no paid plugins.
- Node 22+. `npm run dev`, `npm run build` (runs `scripts/hash-pdfs.mjs` first), `npm run check`.

## Non-negotiables

1. **Sean edits only via the editor at /admin.** Never ask him to touch code, git, Vercel or env vars. If a change needs code, Dana does it. Keep the editable surface to content: copy JSON and the four collections. Layout, routes, styles and data shapes stay in code.
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
src/content/copy/*.json   every page's editable text           src/content/{resources,testimonials,outreach,announcements}/  collections
src/pages/                routes (admin.astro = the editor)    src/pages/api/          serverless: subscribe, download, prospective, contact
src/pages/api/admin/      editor API: login, logout, session, file, collection, entry, blob, resource
src/lib/admin/            auth, store (GitHub + local), schema (what is editable), frontmatter
src/lib/copy.ts + components/T.astro   copy lookup and the data-edit tag
src/data/                 code-owned data (socials, icons, sample gigs)   src/pages/og/   build-time OG images
private/resources/        PDFs (uploaded via the editor)       public/uploads/          images (uploaded via the editor)
scripts/hash-pdfs.mjs     stages hashed PDF copies at build
```

Env vars: see `.env.example`. HANDOVER.md is Sean's guide to the editor plus Dana's setup notes.
