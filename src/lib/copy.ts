// All editable page copy, loaded from src/content/copy/*.json.
// Keys are addressed as "<page>.<path.to.value>" — the same address the /admin editor
// uses and that <T> stamps onto rendered elements as data-edit.
import global from '../content/copy/global.json';
import home from '../content/copy/home.json';
import about from '../content/copy/about.json';
import music from '../content/copy/music.json';
import gigs from '../content/copy/gigs.json';
import outreach from '../content/copy/outreach.json';
import barbershop from '../content/copy/barbershop.json';
import resources from '../content/copy/resources.json';
import contact from '../content/copy/contact.json';
import notfound from '../content/copy/notfound.json';

export const copy = { global, home, about, music, gigs, outreach, barbershop, resources, contact, notfound };
export type CopyPage = keyof typeof copy;

/** Resolve a dotted key like "home.hero.tagline" or "about.playedWith.3". */
export function get(key: string): unknown {
  const [page, ...rest] = key.split('.');
  let cur: unknown = (copy as Record<string, unknown>)[page];
  for (const seg of rest) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

export function text(key: string): string {
  const v = get(key);
  if (v === undefined) { console.warn(`[copy] missing key ${key}`); return ''; }
  return String(v);
}
