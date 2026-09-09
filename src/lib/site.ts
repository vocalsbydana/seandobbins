export const SITE = {
  name: 'Sean Dobbins',
  tagline: 'Drummer. Bandleader. Professor of Jazz Drumset at the Jacobs School of Music.',
  description: 'Sean Dobbins keeps time for Detroit: jazz drummer, bandleader, and Professor of Music (Jazz Studies) at the Indiana University Jacobs School of Music. Home of The Barbershop.',
  locale: 'en_US',
  repo: 'vocalsbydana/seandobbins',
};

import { copy } from './copy';

/** Primary nav. Labels are editable copy (global.nav.*); routes are code. */
export const NAV = [
  { href: '/music', label: copy.global.nav.music, key: 'global.nav.music' },
  { href: '/gigs', label: copy.global.nav.gigs, key: 'global.nav.gigs' },
  { href: '/outreach', label: copy.global.nav.outreach, key: 'global.nav.outreach' },
  { href: '/about', label: copy.global.nav.about, key: 'global.nav.about' },
  { href: '/barbershop', label: copy.global.nav.barbershop, key: 'global.nav.barbershop' },
];

export function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...opts }).format(d);
}
