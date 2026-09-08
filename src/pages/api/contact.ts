import type { APIRoute } from 'astro';
import { EMAIL_RE, clientIp, json, rateLimited } from '../../lib/gate';

export const prerender = false;

/** Contact form → Sean's inbox via Resend (free tier). Set RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL. */
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, string> = {};
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, { status: 400 }); }
  if (body.hp) return json({ ok: true });

  const name = (body.name || '').trim().slice(0, 120);
  const email = (body.email || '').trim().slice(0, 200);
  const subject = (body.subject || 'Website contact').trim().slice(0, 140);
  const message = (body.message || '').trim().slice(0, 5000);
  if (!name || !EMAIL_RE.test(email) || message.length < 10) return json({ error: 'Please fill in your name, a valid email, and a message.' }, { status: 422 });
  if (rateLimited(`contact:${clientIp(request)}`, 4)) return json({ error: 'Too many messages. Try again in a few minutes.' }, { status: 429 });

  const key = process.env.RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL || import.meta.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL || import.meta.env.CONTACT_FROM_EMAIL || 'onboarding@resend.dev';
  if (!key || !to) {
    console.warn('[contact] RESEND_API_KEY / CONTACT_TO_EMAIL not set. Message from', email, 'was NOT delivered.');
    return json({ error: 'The contact form is not set up yet. Please email Sean directly.' }, { status: 503 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: `Sean Dobbins website <${from}>`,
      to: [to],
      reply_to: email,
      subject: `[seandobbins.com] ${subject}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    }),
  });
  if (!res.ok) { console.error('[contact] resend error', res.status, await res.text().catch(() => '')); return json({ error: 'Could not send right now. Please try again.' }, { status: 502 }); }
  return json({ ok: true });
};
