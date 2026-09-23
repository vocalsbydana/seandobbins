// Runs after `astro build`. The Vercel adapter writes .vercel/output/config.json and ignores vercel.json, so the
// security headers and the monthly self-test cron are merged in here (Build Output API, config.json v3).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = new URL('../.vercel/output/config.json', import.meta.url);
if (!existsSync(path)) { console.log('[vercel-config] no .vercel/output/config.json (not a Vercel build), skipping'); process.exit(0); }
const config = JSON.parse(readFileSync(path, 'utf8'));

const everywhere = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN', // the editor previews pages in a same-origin iframe
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin-allow-popups',
};
const headerRoutes = [
  { src: '^/(.*)$', headers: everywhere, continue: true },
  { src: '^/admin$', headers: { 'x-frame-options': 'DENY', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' }, continue: true },
  { src: '^/api/(.*)$', headers: { 'cache-control': 'no-store' }, continue: true },
];
config.routes = [...headerRoutes, ...(config.routes || [])];
config.crons = [{ path: '/api/admin/selftest', schedule: '0 13 1 * *' }]; // 1st of the month, 13:00 UTC (morning in the US)
writeFileSync(path, JSON.stringify(config, null, 2));
console.log(`[vercel-config] added ${headerRoutes.length} header routes and ${config.crons.length} cron`);
