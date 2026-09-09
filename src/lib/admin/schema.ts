// What the /admin editor can touch. Shared by the API routes (validation) and the admin UI (forms).
// Anything not listed here is code, edited by Dana.

export interface Field {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'boolean' | 'image' | 'slug';
  required?: boolean;
  options?: readonly string[];
  hint?: string;
  default?: string | number | boolean;
}

export interface Collection {
  name: string;
  label: string;
  singular: string;
  dir: string;
  /** Field used to name the file (slugified) when creating an entry. */
  fileFrom: string;
  /** Field shown as the row title in lists. */
  titleField: string;
  subtitleFields?: string[];
  sortBy?: string;
  sortDesc?: boolean;
  hasBody?: boolean;
  bodyLabel?: string;
  fields: Field[];
}

export const TOPICS = ['Time & Feel', 'Comping', 'Brushes', 'Reading', 'Practice', 'On the Bandstand'] as const;
export const REGIONS = ['Midwest', 'Northeast', 'South', 'West', 'Canada', 'Europe', 'Asia & Pacific', 'Africa', 'Latin America'] as const;
export const OUTREACH_TYPES = ['Clinic', 'Masterclass', 'Residency', 'Concert', 'Faculty', 'Festival'] as const;

export const RESOURCE_FIELDS: Field[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, hint: 'Short and specific. Shows on the card.' },
  { name: 'slug', label: 'Web address', type: 'slug', required: true, hint: 'Made from the title. Lowercase words with hyphens. Fixed once published.' },
  { name: 'description', label: 'Description', type: 'textarea', required: true, hint: 'One or two sentences: what it is, who it is for.' },
  { name: 'topic', label: 'Topic', type: 'select', options: TOPICS, required: true },
  { name: 'publishedDate', label: 'Date', type: 'date', required: true },
  { name: 'featured', label: 'Feature on the home page', type: 'boolean', default: false },
];

export const COLLECTIONS: Collection[] = [
  {
    name: 'testimonials', label: 'Testimonials', singular: 'testimonial', dir: 'src/content/testimonials', fileFrom: 'name', titleField: 'name', subtitleFields: ['role'], sortBy: 'order',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'role', label: 'Role', type: 'text', required: true, hint: 'e.g. Jacobs alum, 2019' },
      { name: 'quote', label: 'Quote', type: 'textarea', required: true, hint: 'Two or three sentences in their own words.' },
      { name: 'photo', label: 'Photo', type: 'image', hint: 'Optional square headshot.' },
      { name: 'order', label: 'Order', type: 'number', default: 50, hint: 'Lower numbers show first.' },
    ],
  },
  {
    name: 'announcements', label: 'Announcements', singular: 'announcement', dir: 'src/content/announcements', fileFrom: 'title', titleField: 'title', subtitleFields: ['date'], sortBy: 'date', sortDesc: true, hasBody: true, bodyLabel: 'Details (optional)',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, hint: 'The newest one shows in the blue strip on the home page.' },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'link', label: 'Link', type: 'text', hint: 'Where the strip goes when clicked, e.g. /gigs or a full web address.' },
    ],
  },
  {
    name: 'outreach', label: 'Outreach', singular: 'outreach entry', dir: 'src/content/outreach', fileFrom: 'institution', titleField: 'institution', subtitleFields: ['year', 'city'], sortBy: 'year', sortDesc: true,
    fields: [
      { name: 'institution', label: 'Institution', type: 'text', required: true },
      { name: 'city', label: 'City', type: 'text', required: true, hint: 'e.g. Bloomington, IN or Paris' },
      { name: 'country', label: 'Country', type: 'text', required: true, default: 'United States' },
      { name: 'region', label: 'Region', type: 'select', options: REGIONS, required: true, default: 'Midwest', hint: 'Which group it appears under on the Outreach page.' },
      { name: 'year', label: 'Year', type: 'number', required: true },
      { name: 'type', label: 'Type', type: 'select', options: OUTREACH_TYPES, required: true, default: 'Clinic' },
      { name: 'note', label: 'Note', type: 'text', hint: 'One line, optional.' },
    ],
  },
];

export interface PageDef { id: string; label: string; path: string; file: string; note?: string }

/** Pages whose copy lives in src/content/copy/<id>.json. `path` is what the live preview loads. */
export const PAGES: PageDef[] = [
  { id: 'home', label: 'Home', path: '/', file: 'src/content/copy/home.json' },
  { id: 'about', label: 'About', path: '/about', file: 'src/content/copy/about.json' },
  { id: 'music', label: 'Music', path: '/music', file: 'src/content/copy/music.json' },
  { id: 'gigs', label: 'Gigs', path: '/gigs', file: 'src/content/copy/gigs.json' },
  { id: 'outreach', label: 'Outreach', path: '/outreach', file: 'src/content/copy/outreach.json' },
  { id: 'barbershop', label: 'The Barbershop', path: '/barbershop', file: 'src/content/copy/barbershop.json' },
  { id: 'resources', label: 'Resource library', path: '/barbershop/resources', file: 'src/content/copy/resources.json' },
  { id: 'contact', label: 'Contact', path: '/contact', file: 'src/content/copy/contact.json' },
  { id: 'notfound', label: 'Not-found page', path: '/this-page-does-not-exist', file: 'src/content/copy/notfound.json' },
  { id: 'global', label: 'Menu, footer & shared', path: '/', file: 'src/content/copy/global.json', note: 'Text that appears on every page.' },
];

export const RESOURCES_DIR = 'src/content/resources';
export const PDF_DIR = 'private/resources';
export const UPLOADS_DIR = 'public/uploads';
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** Human label from a key segment: "asideTitle" → "Aside title", "playedWith" → "Played with". */
export function humanize(key: string): string {
  const s = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
