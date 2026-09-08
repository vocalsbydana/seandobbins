import type { APIRoute } from 'astro';
import { subscribe } from '../../lib/mailerlite';
import { EMAIL_RE, clientIp, json, rateLimited } from '../../lib/gate';

export const prerender = false;

/** Prospective-student interest form → MailerLite prospective-students group. */
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, string> = {};
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, { status: 400 }); }
  if (body.hp) return json({ ok: true });

  const email = (body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email.' }, { status: 422 });
  if (rateLimited(`pros:${clientIp(request)}`, 4)) return json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });

  const result = await subscribe({
    email,
    group: 'prospective',
    fields: {
      name: (body.name || '').trim().slice(0, 120),
      program: (body.program || '').trim().slice(0, 60),
      entry_year: (body.year || '').trim().slice(0, 12),
      city: (body.city || '').trim().slice(0, 120),
      note: (body.note || '').trim().slice(0, 600),
      source: 'prospective-form',
    },
  });
  if (!result.ok) return json({ error: 'Could not send right now. Please try again.' }, { status: 502 });
  return json({ ok: true, configured: result.configured });
};
