import type { APIRoute } from 'astro';
import { checkPassword, sessionCookie, adminPassword } from '../../../lib/admin/auth';
import { json, readJson } from '../../../lib/admin/common';
import { clientIp, isRateLimited, rateLimited } from '../../../lib/gate';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!adminPassword()) return json({ error: 'ADMIN_PASSWORD is not set on the server. See HANDOVER.md.' }, { status: 503 });
  const key = `admin-login:${clientIp(request)}`;
  if (isRateLimited(key, 8, 15 * 60 * 1000)) return json({ error: 'Too many attempts. Wait fifteen minutes and try again.' }, { status: 429 });
  const body = await readJson<{ password?: string }>(request);
  const password = (body?.password || '').toString();
  if (!checkPassword(password)) {
    rateLimited(key, 8, 15 * 60 * 1000); // only failures count
    return json({ error: 'That password isn’t right. Try again.' }, { status: 401 });
  }
  return json({ ok: true }, { headers: { 'set-cookie': sessionCookie(request) } });
};
