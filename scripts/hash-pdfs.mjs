// Copies every resource PDF from /private/resources to /public/files/<hash>.pdf
// so the download URL cannot be guessed from the card. The hash is derived from the
// resource slug + DOWNLOAD_SECRET; the /api/download route computes the same hash
// after checking the unlock cookie. Runs as `prebuild`.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const secret = process.env.DOWNLOAD_SECRET || 'dev-secret-change-me';
if (!process.env.DOWNLOAD_SECRET) console.warn('[hash-pdfs] DOWNLOAD_SECRET not set; using the dev secret. Set it in Vercel before launch.');

export function fileHash(slug) {
  return createHash('sha256').update(`${slug}:${secret}`).digest('hex').slice(0, 32);
}

const contentDir = join(root, 'src/content/resources');
const outDir = join(root, 'public/files');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let n = 0;
for (const f of readdirSync(contentDir).filter((f) => f.endsWith('.md'))) {
  const fm = readFileSync(join(contentDir, f), 'utf8');
  const slug = /^slug:\s*"?([a-z0-9-]+)"?/m.exec(fm)?.[1];
  const pdf = /^pdf:\s*"?([^"\n]+)"?/m.exec(fm)?.[1]?.trim();
  if (!slug || !pdf) { console.warn(`[hash-pdfs] ${f}: missing slug or pdf`); continue; }
  const src = join(root, pdf.replace(/^\//, ''));
  if (!existsSync(src)) { console.warn(`[hash-pdfs] ${f}: PDF not found at ${pdf}`); continue; }
  copyFileSync(src, join(outDir, `${fileHash(slug)}.pdf`));
  n++;
}
console.log(`[hash-pdfs] ${n} PDF(s) staged in public/files (${basename(outDir)}).`);
