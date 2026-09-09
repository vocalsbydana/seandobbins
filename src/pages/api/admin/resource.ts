import type { APIRoute } from 'astro';
import { open, json, readJson, fail } from '../../../lib/admin/common';
import { RESOURCE_FIELDS, RESOURCES_DIR, PDF_DIR, UPLOADS_DIR, TOPICS, slugify } from '../../../lib/admin/schema';
import { parse, serialize } from '../../../lib/admin/frontmatter';
import type { Change } from '../../../lib/admin/store';

export const prerender = false;

interface Payload {
  slug: string; title: string; description: string; topic: string; publishedDate: string; featured?: boolean; body?: string;
  pdf?: { sha: string; name: string } | null;
  cover?: { sha: string; name: string; type: string } | null;
  removeCover?: boolean;
  existing?: boolean;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** POST — create or update a resource in one commit: markdown entry + PDF (+ cover). */
export const POST: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  const p = await readJson<Payload>(request);
  if (!p) return json({ error: 'Bad request.' }, { status: 400 });
  try {
    const slug = slugify(p.slug || p.title || '');
    const title = (p.title || '').trim();
    const description = (p.description || '').trim();
    const topic = TOPICS.includes(p.topic as (typeof TOPICS)[number]) ? p.topic : '';
    const publishedDate = /^\d{4}-\d{2}-\d{2}$/.test(p.publishedDate || '') ? p.publishedDate : new Date().toISOString().slice(0, 10);
    for (const f of RESOURCE_FIELDS) {
      const v = ({ slug, title, description, topic, publishedDate } as Record<string, string>)[f.name];
      if (f.required && f.type !== 'boolean' && f.type !== 'date' && !v) return json({ error: `${f.label} is required.` }, { status: 422 });
    }
    const mdPath = `${RESOURCES_DIR}/${slug}.md`;
    const current = await o.store.readFile(mdPath);
    if (current && !p.existing) return json({ error: `A resource with the address “${slug}” already exists. Change the title or open that resource to edit it.` }, { status: 409 });
    if (!current && !p.pdf) return json({ error: 'Please add the PDF.' }, { status: 422 });

    const prev = current ? parse(current.content) : null;
    const pdfPath = `${PDF_DIR}/${slug}.pdf`;
    let cover = String(prev?.data.cover || '');
    const changes: Change[] = [];
    if (p.pdf) changes.push({ path: pdfPath, blobSha: p.pdf.sha });
    if (p.cover) {
      const ext = EXT[p.cover.type] || 'jpg';
      if (cover && cover.startsWith(`/uploads/`) && cover !== `/uploads/${slug}.${ext}`) changes.push({ path: `public${cover}`, delete: true });
      cover = `/uploads/${slug}.${ext}`;
      changes.push({ path: `public${cover}`, blobSha: p.cover.sha });
    } else if (p.removeCover && cover) {
      if (cover.startsWith('/uploads/')) changes.push({ path: `public${cover}`, delete: true });
      cover = '';
    }
    const md = serialize({ title, slug, description, topic, pdf: `/${pdfPath}`, cover, publishedDate, featured: !!p.featured }, String(p.body || ''));
    changes.push({ path: mdPath, content: md });
    const result = await o.store.commit(`content: ${current ? 'update' : 'add'} resource “${title}”`, changes);
    return json({ ok: true, slug, commit: result.sha, branch: result.branch, url: result.url });
  } catch (e) { return fail(e); }
};

/** DELETE { slug } — removes the entry, its PDF and its cover in one commit. */
export const DELETE: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  const p = await readJson<{ slug: string }>(request);
  const slug = slugify(p?.slug || '');
  if (!slug) return json({ error: 'Bad request.' }, { status: 400 });
  try {
    const mdPath = `${RESOURCES_DIR}/${slug}.md`;
    const current = await o.store.readFile(mdPath);
    if (!current) return json({ error: 'Not found.' }, { status: 404 });
    const { data } = parse(current.content);
    const changes: Change[] = [{ path: mdPath, delete: true }];
    const pdf = String(data.pdf || '').replace(/^\//, '');
    if (pdf.startsWith(PDF_DIR + '/')) changes.push({ path: pdf, delete: true });
    const cover = String(data.cover || '');
    if (cover.startsWith('/uploads/')) changes.push({ path: `public${cover}`, delete: true });
    const result = await o.store.commit(`content: delete resource “${data.title || slug}”`, changes);
    return json({ ok: true, commit: result.sha, branch: result.branch, url: result.url });
  } catch (e) { return fail(e); }
};
