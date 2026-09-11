import type { APIRoute } from 'astro';
import { open, json, fail } from '../../../lib/admin/common';
import { youtubeId } from '../../../lib/admin/schema';

export const prerender = false;

/**
 * GET ?url=<youtube link or id> → { ok, id, title, thumbnail, author } using YouTube's public oEmbed endpoint
 * (no API key). A private, deleted or mistyped video comes back ok:false so the editor never publishes a dead embed.
 */
export const GET: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  const raw = new URL(request.url).searchParams.get('url') || '';
  const id = youtubeId(raw);
  if (!id) return json({ ok: false, error: 'That doesn’t look like a YouTube link. Paste the link from the address bar or the Share button.' });
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { signal: ctrl.signal, headers: { 'user-agent': 'seandobbins-admin' } });
    clearTimeout(t);
    if (res.status === 401 || res.status === 403) return json({ ok: false, id, error: 'YouTube says this video is private or can’t be embedded. Make it Public or Unlisted and allow embedding.' });
    if (!res.ok) return json({ ok: false, id, error: 'YouTube couldn’t find a video at that link. Check it and try again.' });
    const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return json({ ok: true, id, title: data.title || '', author: data.author_name || '', thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) { console.error('[admin:video]', (e as Error).message); return json({ ok: false, id, error: 'Couldn’t reach YouTube just now. Try again in a moment.' }); }
};
