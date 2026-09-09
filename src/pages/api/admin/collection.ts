import type { APIRoute } from 'astro';
import { open, json, fail } from '../../../lib/admin/common';
import { COLLECTIONS, RESOURCES_DIR } from '../../../lib/admin/schema';
import { parse } from '../../../lib/admin/frontmatter';

export const prerender = false;

/** GET ?name=testimonials|announcements|outreach|resources → { entries: [{ file, sha, data, body }] } */
export const GET: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  const name = new URL(request.url).searchParams.get('name') || '';
  const dir = name === 'resources' ? RESOURCES_DIR : COLLECTIONS.find((c) => c.name === name)?.dir;
  if (!dir) return json({ error: 'Unknown collection.' }, { status: 400 });
  try {
    const files = (await o.store.listDir(dir)).filter((f) => f.name.endsWith('.md'));
    const entries = await Promise.all(files.map(async (f) => {
      const r = await o.store.readFile(f.path);
      const { data, body } = parse(r?.content || '');
      return { file: f.name, path: f.path, sha: f.sha, data, body };
    }));
    return json({ entries }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) { return fail(e); }
};
