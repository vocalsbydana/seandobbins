import type { APIRoute } from 'astro';
import { open, json, readJson, fail } from '../../../lib/admin/common';
import { PAGES } from '../../../lib/admin/schema';

export const prerender = false;

const allowed = (path: string) => PAGES.some((p) => p.file === path);

/** GET ?path=src/content/copy/home.json → { path, sha, data } */
export const GET: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  const path = new URL(request.url).searchParams.get('path') || '';
  if (!allowed(path)) return json({ error: 'Not an editable file.' }, { status: 400 });
  try {
    const f = await o.store.readFile(path);
    if (!f) return json({ error: 'File not found.' }, { status: 404 });
    return json({ path, sha: f.sha, data: JSON.parse(f.content) }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) { return fail(e); }
};

type Edit = { key: string; value: unknown };

function setPath(root: unknown, segs: string[], value: unknown): boolean {
  let cur = root as Record<string, unknown> | unknown[];
  for (let i = 0; i < segs.length - 1; i++) {
    const next = (cur as Record<string, unknown>)[segs[i]];
    if (next == null || typeof next !== 'object') return false;
    cur = next as Record<string, unknown>;
  }
  (cur as Record<string, unknown>)[segs[segs.length - 1]] = value;
  return true;
}

/**
 * PUT { path, edits: [{key, value}], replace?: object }
 * Applies edits by key onto a fresh copy of the file (so two people editing different fields don't clobber
 * each other). `replace` swaps whole top-level sections (used when list items are added or removed).
 */
export const PUT: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  const body = await readJson<{ path: string; edits?: Edit[]; replace?: Record<string, unknown>; page?: string }>(request);
  if (!body || !allowed(body.path)) return json({ error: 'Not an editable file.' }, { status: 400 });
  try {
    const fresh = await o.store.readFile(body.path);
    if (!fresh) return json({ error: 'File not found.' }, { status: 404 });
    const data = JSON.parse(fresh.content) as Record<string, unknown>;
    let applied = 0;
    for (const [section, value] of Object.entries(body.replace || {})) { if (section in data) { data[section] = value; applied++; } }
    for (const e of body.edits || []) {
      const segs = e.key.split('.');
      if (segs[0] === body.page) segs.shift();
      if (setPath(data, segs, e.value)) applied++;
    }
    if (!applied) return json({ error: 'Nothing could be applied. The content changed underneath you; reload and try again.' }, { status: 409 });
    const message = `Admin edit: ${body.page ? '/' + (body.page === 'home' ? '' : body.page) : body.path} (${applied} change${applied === 1 ? '' : 's'})`;
    const result = await o.store.commit(message, [{ path: body.path, content: JSON.stringify(data, null, 2) + '\n' }]);
    return json({ ok: true, commit: result.sha, branch: result.branch, url: result.url, applied, data });
  } catch (e) { return fail(e); }
};
