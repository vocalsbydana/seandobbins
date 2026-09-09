import type { APIRoute } from 'astro';
import { open, json, readJson, fail } from '../../../lib/admin/common';
import { COLLECTIONS, slugify, type Field } from '../../../lib/admin/schema';
import { serialize, type Scalar } from '../../../lib/admin/frontmatter';

export const prerender = false;

function coerce(field: Field, raw: unknown): Scalar | undefined {
  if (raw === undefined || raw === null) return field.type === 'boolean' ? false : field.default !== undefined ? field.default : undefined;
  switch (field.type) {
    case 'number': { const n = Number(raw); return Number.isFinite(n) ? n : (field.default as number | undefined); }
    case 'boolean': return raw === true || raw === 'true';
    case 'date': return String(raw).slice(0, 10);
    case 'select': return field.options?.includes(String(raw)) ? String(raw) : String(field.default ?? field.options?.[0] ?? '');
    default: return String(raw).trim();
  }
}

/** PUT { collection, file?, data, body? } — create (no file) or update an entry. */
export const PUT: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  const body = await readJson<{ collection: string; file?: string; data: Record<string, unknown>; body?: string }>(request);
  const col = COLLECTIONS.find((c) => c.name === body?.collection);
  if (!body || !col) return json({ error: 'Unknown collection.' }, { status: 400 });
  try {
    const data: Record<string, Scalar | undefined> = {};
    for (const f of col.fields) {
      const v = coerce(f, body.data?.[f.name]);
      if (f.required && (v === undefined || v === '')) return json({ error: `${f.label} is required.` }, { status: 422 });
      data[f.name] = v;
    }
    let file = body.file;
    if (file && !/^[a-z0-9-]+\.md$/.test(file)) return json({ error: 'Bad file name.' }, { status: 400 });
    if (!file) {
      const base = slugify(String(data[col.fileFrom] || '')) || 'entry';
      const existing = new Set((await o.store.listDir(col.dir)).map((e) => e.name));
      file = `${base}.md`; let n = 2;
      while (existing.has(file)) file = `${base}-${n++}.md`;
    }
    const content = serialize(data, col.hasBody ? String(body.body || '') : '');
    const result = await o.store.commit(`content: ${body.file ? 'update' : 'add'} ${col.singular} “${data[col.titleField]}”`, [{ path: `${col.dir}/${file}`, content }]);
    return json({ ok: true, file, commit: result.sha, branch: result.branch, url: result.url });
  } catch (e) { return fail(e); }
};

/** DELETE { collection, file } */
export const DELETE: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  const body = await readJson<{ collection: string; file: string }>(request);
  const col = COLLECTIONS.find((c) => c.name === body?.collection);
  if (!body || !col || !/^[a-z0-9-]+\.md$/.test(body.file || '')) return json({ error: 'Bad request.' }, { status: 400 });
  try {
    const result = await o.store.commit(`content: delete ${col.singular} ${body.file}`, [{ path: `${col.dir}/${body.file}`, delete: true }]);
    return json({ ok: true, commit: result.sha, branch: result.branch, url: result.url });
  } catch (e) { return fail(e); }
};
