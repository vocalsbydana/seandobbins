// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

const site = process.env.SITE_URL || 'https://seandobbins.com';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'never',
  adapter: vercel({
    imageService: false, // Astro's sharp service optimizes photos at build time (no Vercel image quota)
    // PDFs are copied to public/files/<hash>.pdf by scripts/hash-pdfs.mjs before build.
  }),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin') && !page.includes('/api/') && !page.includes('/og/'),
    }),
  ],
  image: {
    responsiveStyles: true,
  },
  prefetch: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
