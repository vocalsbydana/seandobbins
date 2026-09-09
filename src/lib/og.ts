// Build-time Open Graph image renderer (satori + resvg). 1200×630, brand-locked.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

// Build runs from the project root; bundled chunks move, so resolve from cwd.
const root = new URL(`file://${process.cwd()}/`);
let fonts: { name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' | 'italic' }[] | null = null;
const photoCache = new Map<string, string>();

async function loadFonts() {
  if (fonts) return fonts;
  // Static instances only: satori/opentype.js cannot parse variable TTFs.
  const load = async (file: string) => { const b = await readFile(new URL(`src/assets/fonts/${file}`, root)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  fonts = [
    { name: 'Bebas Neue', data: await load('BebasNeue-Regular.ttf'), weight: 400, style: 'normal' },
    { name: 'Bricolage Grotesque', data: await load('BricolageGrotesque-Regular.woff'), weight: 400, style: 'normal' },
    { name: 'Bricolage Grotesque', data: await load('BricolageGrotesque-SemiBold.woff'), weight: 600, style: 'normal' },
    { name: 'Newsreader', data: await load('Newsreader-Italic.woff'), weight: 400, style: 'italic' },
  ];
  return fonts;
}

async function photoDataUri(file: string, grayscale: boolean) {
  const key = `${file}:${grayscale}`;
  if (photoCache.has(key)) return photoCache.get(key)!;
  let img = sharp(new URL(`src/assets/photos/${file}`, root).pathname).resize(640, 630, { fit: 'cover', position: 'attention' });
  if (grayscale) img = img.grayscale();
  const buf = await img.jpeg({ quality: 72 }).toBuffer();
  const uri = `data:image/jpeg;base64,${buf.toString('base64')}`;
  photoCache.set(key, uri);
  return uri;
}

export interface OgSpec { title: string; eyebrow?: string; sub?: string; photo?: string; grayscale?: boolean; voice?: string }

export async function renderOg(spec: OgSpec): Promise<Uint8Array> {
  const f = await loadFonts();
  const photo = spec.photo ? await photoDataUri(spec.photo, spec.grayscale ?? true) : null;
  const titleSize = spec.title.length > 26 ? 84 : spec.title.length > 16 ? 108 : 132;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: { width: 1200, height: 630, display: 'flex', background: '#0B0B14', color: '#F3EEE5', fontFamily: 'Bricolage Grotesque', position: 'relative' },
        children: [
          photo && { type: 'img', props: { src: photo, width: 640, height: 630, style: { position: 'absolute', right: 0, top: 0, width: 640, height: 630, objectFit: 'cover', opacity: 0.55 } } },
          { type: 'div', props: { style: { position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #0B0B14 42%, rgba(11,11,20,0.55) 70%, rgba(18,18,106,0.35) 100%)' } } },
          { type: 'div', props: { style: { position: 'absolute', left: 0, top: 0, width: 1200, height: 6, background: '#C49A5F' } } },
          {
            type: 'div',
            props: {
              style: { position: 'absolute', left: 72, top: 64, right: 72, bottom: 64, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
              children: [
                { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: 18 }, children: [
                  { type: 'div', props: { style: { position: 'relative', width: 44, height: 44, display: 'flex' }, children: [
                    { type: 'div', props: { style: { position: 'absolute', left: 0, top: 0, width: 44, height: 44, borderRadius: 22, border: '4px solid #F3EEE5' } } },
                    { type: 'div', props: { style: { position: 'absolute', left: 20, top: 20, width: 4, height: 4, borderRadius: 2, background: '#F3EEE5' } } },
                    // Drumstick: tapered shaft + bead tip, always brass.
                    { type: 'div', props: { style: { position: 'absolute', left: -7, top: 20.5, width: 58, height: 3, transform: 'rotate(-32deg)', display: 'flex' }, children: [
                      { type: 'div', props: { style: { position: 'absolute', left: 0, top: 0, width: 53.2, height: 3, background: '#C49A5F', borderRadius: 3 } } },
                      { type: 'div', props: { style: { position: 'absolute', right: 0, top: -0.2, width: 4.8, height: 3.4, background: '#C49A5F', borderRadius: 3 } } },
                    ] } },
                  ] } },
                  { type: 'div', props: { style: { fontFamily: 'Bebas Neue', fontSize: 40, letterSpacing: 1.2, lineHeight: 1 }, children: 'SEAN DOBBINS' } },
                ] } },
                { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 760 }, children: [
                  spec.eyebrow && { type: 'div', props: { style: { fontSize: 20, letterSpacing: 4, color: '#C49A5F' }, children: spec.eyebrow.toUpperCase() } },
                  { type: 'div', props: { style: { fontFamily: 'Bebas Neue', fontSize: titleSize, lineHeight: 0.86, letterSpacing: 1 }, children: spec.title.toUpperCase() } },
                  spec.voice && { type: 'div', props: { style: { fontFamily: 'Newsreader', fontStyle: 'italic', fontSize: 30, lineHeight: 1.25, color: 'rgba(243,238,229,0.85)' }, children: `“${spec.voice}”` } },
                  spec.sub && { type: 'div', props: { style: { fontSize: 24, lineHeight: 1.35, color: 'rgba(243,238,229,0.75)' }, children: spec.sub } },
                ].filter(Boolean) } },
                { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: 14, fontSize: 18, letterSpacing: 4, color: 'rgba(243,238,229,0.6)' }, children: [
                  { type: 'div', props: { style: { width: 36, height: 2, background: '#C49A5F' } } },
                  { type: 'div', props: { children: 'SEANDOBBINS.COM' } },
                ] } },
              ],
            },
          },
        ].filter(Boolean),
      },
    },
    { width: 1200, height: 630, fonts: f },
  );
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
