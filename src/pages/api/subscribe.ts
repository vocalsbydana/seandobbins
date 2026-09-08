import type { APIRoute } from 'astro';
import { subscribe } from '../../lib/mailerlite';
import { EMAIL_RE, clientIp, cookieHeader, json, mintCookieValue, rateLimited } from '../../lib/gate';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, string> = {};
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, { status: 400 }); }

  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim().slice(0, 120);
  const slug = (body.slug || '').trim().slice(0, 80);
  const source = (body.source || 'resource').trim().slice(0, 40);
  const secure = new URL(request.url).protocol === 'https:';

  // Honeypot: bots fill the hidden field. Pretend success, do nothing.
  if (body.hp) return json({ ok: true });

  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email.' }, { status: 422 });
  if (rateLimited(`sub:${clientIp(request)}`)) return json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });

  const result = await subscribe({
    email,
    group: 'drummers',
    fields: { name, source, last_resource: slug, first_resource: slug },
  });
  if (!result.ok) return json({ error: 'Could not subscribe right now. Please try again.' }, { status: 502 });

  // Unlock cookie only matters for resource downloads, but it's harmless on newsletter signups too.
  return json({ ok: true, configured: result.configured }, { headers: { 'set-cookie': cookieHeader(mintCookieValue(), secure) } });
};
