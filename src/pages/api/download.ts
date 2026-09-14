import type { APIRoute } from 'astro';
import { COOKIE_NAME, cookieHeader, fileHash, mintCookieValue, readCookie, verifyCookieValue } from '../../lib/gate';

export const prerender = false;

/** Verifies the unlock cookie, then redirects to the hashed PDF path staged at build time. */
export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') || '';
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return new Response('Not found', { status: 404 });

  const ok = verifyCookieValue(readCookie(request.headers.get('cookie'), COOKIE_NAME));
  if (!ok) return redirect(`/barbershop/resources/${slug}?locked=1`, 302);

  // Browsers cap cookie lifetime (Chrome: ~400 days), so re-issue it on every download to keep it rolling.
  const secure = url.protocol === 'https:';
  return new Response(null, { status: 302, headers: { location: `/files/${fileHash(slug)}.pdf`, 'set-cookie': cookieHeader(mintCookieValue(), secure) } });
};
