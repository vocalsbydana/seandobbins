import type { APIRoute } from 'astro';
import { open, json, fail } from '../../../lib/admin/common';
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES } from '../../../lib/admin/schema';

export const prerender = false;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * POST multipart/form-data { file, kind: "pdf" | "image" } → { sha, size, name, type }
 * Stages the bytes as a git blob (or a local temp file in dev); the resource commit references the sha.
 * Vercel caps request bodies at 4.5 MB, hence MAX_PDF_BYTES.
 */
export const POST: APIRoute = async ({ request }) => {
  const o = open(request); if ('response' in o) return o.response;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const kind = String(form.get('kind') || 'pdf');
    if (!(file instanceof File)) return json({ error: 'No file received.' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (kind === 'pdf') {
      if (bytes.length > MAX_PDF_BYTES) return json({ error: `That PDF is ${(bytes.length / 1048576).toFixed(1)} MB. The limit is 4 MB; try exporting it at a smaller size.` }, { status: 413 });
      const head = Buffer.from(bytes.slice(0, 5)).toString('latin1');
      if (!head.startsWith('%PDF')) return json({ error: 'That file isn’t a PDF.' }, { status: 415 });
    } else if (kind === 'image') {
      if (bytes.length > MAX_IMAGE_BYTES) return json({ error: `That image is ${(bytes.length / 1048576).toFixed(1)} MB. The limit is 2 MB.` }, { status: 413 });
      if (!IMAGE_TYPES.has(file.type)) return json({ error: 'Use a JPG, PNG or WebP image.' }, { status: 415 });
    } else return json({ error: 'Unknown upload kind.' }, { status: 400 });
    const sha = await o.store.createBlob(bytes);
    return json({ ok: true, sha, size: bytes.length, name: file.name, type: file.type });
  } catch (e) { return fail(e); }
};
