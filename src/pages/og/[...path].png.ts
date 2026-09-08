import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOg, type OgSpec } from '../../lib/og';

// One OG image per page, generated at build. URL: /og/<path>.png (home → /og/home.png).
const PAGES: Record<string, OgSpec> = {
  home: { title: 'Serve the music. Keep the joy.', eyebrow: 'Jazz drummer · Detroit · Bloomington', photo: 'stage-blue.jpg', voice: 'You’ve got to make the band feel good before you make yourself sound good.' },
  about: { title: 'About', eyebrow: 'Drummer · Bandleader · Professor, IU Jacobs', sub: 'Detroit sideman, Woody Herman Jazz Award, Louis Armstrong Scholarship, and the jazz drumset studio at Jacobs.', photo: 'bw-stars.jpg' },
  outreach: { title: 'Clinics & masterclasses', eyebrow: 'Outreach', sub: 'Residencies, clinics and concerts for students across the US and abroad.', photo: 'stage-kit.jpg' },
  music: { title: 'Watch & listen', eyebrow: 'Music', sub: 'Live video, streaming links, and selected discography.', photo: 'laugh-warm.jpg' },
  gigs: { title: 'Upcoming dates', eyebrow: 'Gigs', sub: 'Trio, quartet and sideman dates. Add any show to your calendar.', photo: 'stage-blue.jpg' },
  barbershop: { title: 'The Barbershop', eyebrow: "Sean Dobbins' studio · IU Jacobs", sub: 'A weekly hang, not a class. Teaching philosophy, student stories, and free resources.', photo: 'profile-brushes.jpg' },
  'barbershop/resources': { title: 'Free resources', eyebrow: 'The Barbershop', sub: 'PDFs for jazz drummers. One email unlocks the whole library.', photo: 'stage-kit.jpg' },
  contact: { title: 'Book Sean', eyebrow: 'Contact', sub: 'Gigs, clinics, masterclasses, residencies, press.', photo: 'laugh-warm.jpg' },
};

export const getStaticPaths: GetStaticPaths = async () => {
  const resources = await getCollection('resources');
  return [
    ...Object.entries(PAGES).map(([path, spec]) => ({ params: { path }, props: { spec } })),
    ...resources.map((r) => ({ params: { path: `resources/${r.data.slug}` }, props: { spec: { title: r.data.title, eyebrow: `The Barbershop · Free resource · ${r.data.topic}`, sub: r.data.description, photo: 'profile-brushes.jpg' } satisfies OgSpec } })),
  ];
};

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOg(props.spec as OgSpec);
  return new Response(Buffer.from(png), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' } });
};
