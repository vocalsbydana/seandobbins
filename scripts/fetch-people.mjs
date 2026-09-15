// Fetches a real, free-licensed photo for each name in src/data/played-with.json at build time.
// For entries with `wiki` (Wikipedia article title candidates) it asks the Wikipedia API for the
// article's free lead image, then Wikimedia Commons for the photographer + licence, downloads a
// 480px copy to public/people/<slug>.<ext>, and writes public/people/manifest.json.
// Entries with `file` (a photo in src/assets/people/) are left to the page; this script skips them.
// Network failures are never fatal: a name without a photo just renders as plain text.
// Runs as part of `prebuild`. Set SKIP_PEOPLE=1 to skip (e.g. offline dev).
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const UA = 'seandobbinsmusic.com build (contact: dana@vocalsbydana.com)';
const MUSIC = /jazz|music|pianist|bassist|drummer|saxophon|trumpet|singer|organist|guitar|compos|vocal|blues|bandleader|trombon|flut|clarinet|band/i;

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function getJson(url, fetchImpl) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
  try { const r = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctrl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(t); }
}

/** Find the free lead image for the first candidate article that is clearly about a musician. */
export async function findArticleImage(candidates, fetchImpl = fetch) {
  for (const title of candidates) {
    const q = new URLSearchParams({ action: 'query', format: 'json', redirects: '1', prop: 'pageimages|description', piprop: 'name', pilicense: 'free', titles: title });
    let data; try { data = await getJson(`https://en.wikipedia.org/w/api.php?${q}`, fetchImpl); } catch { continue; }
    const page = Object.values(data?.query?.pages || {})[0];
    if (!page || page.missing !== undefined || !page.pageimage) continue;
    const desc = page.description || '';
    if (!MUSIC.test(desc)) { console.warn(`[people] "${title}" description "${desc}" does not look like a musician; skipping`); continue; }
    return { article: page.title, file: page.pageimage, description: desc };
  }
  return null;
}

/** Photographer, licence, source page and a 480px thumbnail URL for a Commons (or enwiki) file. */
export async function fileInfo(file, fetchImpl = fetch) {
  const q = new URLSearchParams({ action: 'query', format: 'json', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '480', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|Credit' });
  for (const host of ['commons.wikimedia.org', 'en.wikipedia.org']) {
    let data; try { data = await getJson(`https://${host}/w/api.php?${q}`, fetchImpl); } catch { continue; }
    const page = Object.values(data?.query?.pages || {})[0];
    const ii = page?.imageinfo?.[0]; if (!ii?.thumburl) continue;
    const m = ii.extmetadata || {};
    return { thumb: ii.thumburl, mime: ii.mime, source: ii.descriptionurl, artist: strip(m.Artist?.value), license: strip(m.LicenseShortName?.value), licenseUrl: strip(m.LicenseUrl?.value) };
  }
  return null;
}

export async function resolvePerson(entry, fetchImpl = fetch) {
  const found = await findArticleImage(entry.wiki, fetchImpl);
  if (!found) return null;
  const info = await fileInfo(found.file, fetchImpl);
  if (!info) return null;
  return { name: entry.name, article: found.article, ...info };
}

async function main() {
  const outDir = join(root, 'public/people'); mkdirSync(outDir, { recursive: true });
  const manifestPath = join(outDir, 'manifest.json');
  const people = JSON.parse(readFileSync(join(root, 'src/data/played-with.json'), 'utf8'));
  const todo = people.filter((p) => Array.isArray(p.wiki) && p.wiki.length && !p.file);
  if (process.env.SKIP_PEOPLE || !todo.length) { if (!existsSync(manifestPath)) writeFileSync(manifestPath, '[]\n'); console.log('[people] skipped'); return; }

  const results = await Promise.all(todo.map(async (entry) => {
    try {
      const r = await resolvePerson(entry);
      if (!r) { console.warn(`[people] no free photo found for ${entry.name}`); return null; }
      const ext = r.mime === 'image/png' ? 'png' : 'jpg';
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(r.thumb, { headers: { 'user-agent': UA }, signal: ctrl.signal }).finally(() => clearTimeout(t));
      if (!res.ok) throw new Error(`thumb HTTP ${res.status}`);
      const file = `${slug(entry.name)}.${ext}`;
      writeFileSync(join(outDir, file), Buffer.from(await res.arrayBuffer()));
      console.log(`[people] ${entry.name} ← ${r.article} (${r.license || 'licence unknown'}, ${r.artist || 'no author'})`);
      return { name: entry.name, src: `/people/${file}`, artist: r.artist, license: r.license, licenseUrl: r.licenseUrl, source: r.source, article: r.article };
    } catch (e) { console.warn(`[people] ${entry.name}: ${e.message}`); return null; }
  }));
  const manifest = results.filter(Boolean);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[people] ${manifest.length}/${todo.length} photos staged`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
