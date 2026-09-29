// Photos attached to outreach entries (src/data/outreach-photos.json → src/assets/outreach/*). Build-time only:
// each photo gets a small thumbnail and a large lightbox copy, both WebP, via Astro's image service.
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import data from '../data/outreach-photos.json';

export interface OutreachPhoto { thumb: string; full: string; w: number; h: number; alt: string; credit: string }

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/outreach/*.{jpg,jpeg,png,webp}', { eager: true });
const byName = new Map(Object.entries(files).map(([path, mod]) => [path.split('/').pop()!, mod.default]));

let cache: Promise<Record<string, OutreachPhoto[]>> | null = null;
export function outreachPhotos(): Promise<Record<string, OutreachPhoto[]>> {
  cache ??= (async () => {
    const out: Record<string, OutreachPhoto[]> = {};
    for (const [id, list] of Object.entries(data)) {
      if (id.startsWith('_') || !Array.isArray(list)) continue;
      out[id] = [];
      for (const p of list as { file: string; alt: string; credit?: string }[]) {
        const src = byName.get(p.file);
        if (!src) { console.warn(`[outreach-photos] missing file src/assets/outreach/${p.file}`); continue; }
        const [thumb, full] = await Promise.all([
          getImage({ src, width: 320, format: 'webp', quality: 72 }),
          getImage({ src, width: Math.min(1600, src.width), format: 'webp', quality: 80 }),
        ]);
        out[id].push({ thumb: thumb.src, full: full.src, w: src.width, h: src.height, alt: p.alt, credit: p.credit || '' });
      }
    }
    return out;
  })();
  return cache;
}
