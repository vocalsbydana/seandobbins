import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

// Everything Sean edits lives here (via Decap CMS at /admin). See CLAUDE.md.

export const TOPICS = [
  'Time & Feel',
  'Comping',
  'Brushes',
  'Reading',
  'Practice',
  'On the Bandstand',
] as const;

const resources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/resources' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    description: z.string(),
    topic: z.enum(TOPICS),
    pdf: z.string(),           // path under /private/resources, written by the CMS
    cover: z.string().optional(), // /uploads/... image
    publishedDate: z.coerce.date(),
    featured: z.boolean().default(false),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/testimonials' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    quote: z.string(),
    photo: z.string().optional(),
    order: z.number().default(50),
  }),
});

export const REGIONS = ['Midwest', 'Northeast', 'South', 'West', 'Canada', 'Europe', 'Asia & Pacific', 'Africa', 'Latin America'] as const;

const outreach = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/outreach' }),
  schema: z.object({
    institution: z.string(),
    city: z.string(),
    country: z.string(),
    region: z.enum(REGIONS),
    year: z.number().int().min(1990).max(2100),
    type: z.enum(['Clinic', 'Masterclass', 'Residency', 'Concert', 'Faculty', 'Festival']).default('Clinic'),
    note: z.string().optional(),
  }),
});

const announcements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/announcements' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    link: z.string().optional(),
  }),
});

const settings = defineCollection({
  loader: file('./src/content/settings/site.json', { parser: (text) => [{ id: 'site', ...JSON.parse(text) }] }),
  schema: z.object({
    heroEyebrow: z.string(),
    heroTagline: z.string(),
    heroTitle: z.string(),
    heroPhilosophy: z.string(),
    featuredYoutubeId: z.string(),
    shortBio: z.string(),
    bookingEmail: z.string().optional(),
  }),
});

export const collections = { resources, testimonials, outreach, announcements, settings };
