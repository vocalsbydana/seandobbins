import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { isAuthed } from '../../../lib/admin/auth';
import { COOKIE_NAME, json, mintCookieValue } from '../../../lib/gate';

export const prerender = false;

/**
 * Monthly site check. Vercel's cron (scripts/vercel-config.mjs) calls this on the 1st with `Authorization: Bearer
 * CRON_SECRET` and the report is emailed to SELFTEST_TO_EMAIL (Dana). The editor's "Site check" tab calls it with the
 * admin session (add ?email=1 to also send the email). Nothing here changes any data: it reads settings, pings the
 * services the site depends on, and exercises the resource gate with a cookie minted for the purpose.
 */
const env = (n: string) => process.env[n] || (import.meta.env as Record<string, string | undefined>)[n];
type Check = { name: string; ok: boolean; detail: string; fix?: string };
const TIMEOUT = 8000;
const get = (url: string, init: RequestInit = {}) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT), ...init });
const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/New_York' });

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const cronSecret = env('CRON_SECRET');
  const fromCron = !!cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`;
  if (!fromCron && !isAuthed(request)) return json({ error: 'Please log in.' }, { status: 401 });
  const wantEmail = fromCron || url.searchParams.get('email') === '1';
  const site = (env('SITE_URL') || 'https://seandobbinsmusic.com').replace(/\/$/, '');
  const checks: Check[] = [];
  const add = (c: Check) => { checks.push(c); };

  // 1. Settings present
  const required = ['DOWNLOAD_SECRET', 'ADMIN_PASSWORD', 'GITHUB_TOKEN', 'MAILERLITE_API_KEY', 'RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL', 'CRON_SECRET', 'SELFTEST_TO_EMAIL'];
  const missing = required.filter((n) => !env(n));
  add({ name: 'Settings', ok: missing.length === 0, detail: missing.length ? `Missing on Vercel: ${missing.join(', ')}` : 'Every required setting is present',
    fix: missing.length ? 'Vercel → the project → Settings → Environment Variables. Add the missing ones (see .env.example in the repo), then Deployments → Redeploy.' : undefined });

  await Promise.all([
    // 2. Live site
    (async () => {
      try { const r = await get(`${site}/`); const html = r.status === 200 ? await r.text() : ''; add({ name: 'Site is up', ok: r.status === 200 && html.includes('Sean Dobbins'), detail: r.status === 200 ? 'Home page loads' : `Home page answered ${r.status}`, fix: r.status === 200 ? undefined : 'Check Vercel → Deployments for a failed build.' }); }
      catch (e) { add({ name: 'Site is up', ok: false, detail: `Could not reach ${site}: ${(e as Error).message}`, fix: 'Check the domain in Vercel → Settings → Domains.' }); }
    })(),
    // 3. Resource gate: locked without the cookie, serves the PDF with it
    (async () => {
      try {
        const first = (await getCollection('resources'))[0];
        if (!first) { add({ name: 'Resource gate', ok: true, detail: 'No resources yet, nothing to test' }); return; }
        const slug = first.data.slug || first.id;
        const locked = await get(`${site}/api/download?slug=${slug}`);
        const lockedOk = locked.status === 302 && (locked.headers.get('location') || '').includes('locked=1');
        const open = await get(`${site}/api/download?slug=${slug}`, { headers: { cookie: `${COOKIE_NAME}=${mintCookieValue()}` } });
        const loc = open.headers.get('location') || '';
        const file = open.status === 302 && loc.startsWith('/files/') ? await get(`${site}${loc}`, { method: 'HEAD' }) : null;
        const fileOk = !!file && file.status === 200;
        add({ name: 'Resource gate', ok: lockedOk && fileOk, detail: `${lockedOk ? 'Locks strangers out' : `Did not lock (answered ${locked.status})`}; ${fileOk ? 'serves the PDF once unlocked' : `PDF not served (${file ? file.status : open.status})`} (tested “${first.data.title}”)`,
          fix: lockedOk && fileOk ? undefined : 'If the PDF is not served, DOWNLOAD_SECRET may differ between builds or the file is missing from private/resources. Redeploy first.' });
      } catch (e) { add({ name: 'Resource gate', ok: false, detail: `Could not test the gate on ${site} (${(e as Error).message})` }); }
    })(),
    // 4. Contact function answers (honeypot filled, so nothing is sent; Resend is proven by this email arriving)
    (async () => {
      try { const r = await get(`${site}/api/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hp: 'x' }) }); add({ name: 'Contact form', ok: r.status === 200, detail: r.status === 200 ? 'The form’s function answers (this email arriving proves Resend works too)' : `Answered ${r.status}` }); }
      catch (e) { add({ name: 'Contact form', ok: false, detail: `Could not reach ${site}/api/contact (${(e as Error).message})` }); }
    })(),
    // 5. MailerLite key
    (async () => {
      const key = env('MAILERLITE_API_KEY');
      if (!key) { add({ name: 'Newsletter (MailerLite)', ok: false, detail: 'MAILERLITE_API_KEY is not set: sign-ups are not being recorded', fix: 'MailerLite → Integrations → API → generate a token; add it as MAILERLITE_API_KEY on Vercel.' }); return; }
      try { const r = await get('https://connect.mailerlite.com/api/subscribers?limit=1', { headers: { authorization: `Bearer ${key}`, accept: 'application/json' } }); add({ name: 'Newsletter (MailerLite)', ok: r.ok, detail: r.ok ? 'API key accepted' : `MailerLite answered ${r.status}`, fix: r.ok ? undefined : 'The key was revoked or expired. Generate a new one in MailerLite → Integrations → API and update MAILERLITE_API_KEY on Vercel.' }); }
      catch (e) { add({ name: 'Newsletter (MailerLite)', ok: false, detail: (e as Error).message }); }
    })(),
    // 6. GitHub token (the editor's Publish button) and its expiry
    (async () => {
      const token = env('GITHUB_TOKEN'), repo = env('GITHUB_REPO') || 'vocalsbydana/seandobbins';
      const fix = 'Make a new fine-grained token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate. Repository access: only this repo. Permissions: Contents, read and write. Then Vercel → the project → Settings → Environment Variables → GITHUB_TOKEN → edit, save, and Redeploy. Open /admin and publish a small change to confirm.';
      if (!token) { add({ name: 'Editor’s GitHub token', ok: false, detail: 'GITHUB_TOKEN is not set: Publish in the editor cannot work', fix }); return; }
      try {
        const r = await get(`https://api.github.com/repos/${repo}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'seandobbins-selftest' } });
        const exp = r.headers.get('github-authentication-token-expiration'); // e.g. "2027-09-23 05:00:00 UTC"
        const expires = exp ? new Date(exp.replace(' UTC', 'Z').replace(' ', 'T')) : null;
        const days = expires && !isNaN(+expires) ? Math.floor((+expires - Date.now()) / 86400000) : null;
        const soon = days !== null && days < 45;
        add({ name: 'Editor’s GitHub token', ok: r.ok && !soon,
          detail: !r.ok ? `GitHub answered ${r.status}: the token is expired, revoked or lacks access` : days === null ? 'Token works (no expiry reported)' : `Token works; expires ${fmt(expires!)} (${days} days left)`,
          fix: r.ok && !soon ? undefined : fix });
      } catch (e) { add({ name: 'Editor’s GitHub token', ok: false, detail: (e as Error).message, fix }); }
    })(),
  ]);

  const problems = checks.filter((c) => !c.ok);
  const ran = new Date();
  const lines = [
    `${site.replace('https://', '')} monthly check, ${fmt(ran)}`,
    problems.length ? `${problems.length} problem${problems.length === 1 ? '' : 's'} need${problems.length === 1 ? 's' : ''} attention.` : `All ${checks.length} checks passed.`,
    '',
    ...checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}${c.fix && !c.ok ? `\n   How to fix: ${c.fix}` : ''}`),
    '',
    `Run this any time from the editor: ${site}/admin → Site check. If this email ever stops arriving on the 1st, the Resend key or the cron is broken; open the Site check tab to see which.`,
  ];
  const text = lines.join('\n');
  const subject = problems.length ? `Site check: ${problems.length} problem${problems.length === 1 ? '' : 's'} on ${site.replace('https://', '')}` : `Site check: all good on ${site.replace('https://', '')}`;

  let email: { sent: boolean; to?: string; error?: string } = { sent: false };
  if (wantEmail) {
    const key = env('RESEND_API_KEY'), to = env('SELFTEST_TO_EMAIL') || env('CONTACT_TO_EMAIL'), from = env('CONTACT_FROM_EMAIL') || 'onboarding@resend.dev';
    if (!key || !to) email = { sent: false, error: 'RESEND_API_KEY or SELFTEST_TO_EMAIL not set' };
    else {
      try {
        const r = await get('https://api.resend.com/emails', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ from: `Sean Dobbins website <${from}>`, to: [to], subject, text }) });
        email = r.ok ? { sent: true, to } : { sent: false, to, error: `Resend answered ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}` };
      } catch (e) { email = { sent: false, to, error: (e as Error).message }; }
      if (!email.sent) console.error('[selftest] email failed', email.error);
    }
  }
  return json({ ok: problems.length === 0, ran: ran.toISOString(), site, checks, email, text }, { headers: { 'cache-control': 'no-store' } });
};
