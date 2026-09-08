export const SITE = {
  name: 'Sean Dobbins',
  tagline: 'Drummer. Bandleader. Professor of Jazz Drumset at the Jacobs School of Music.',
  description: 'Sean Dobbins keeps time for Detroit: jazz drummer, bandleader, and Professor of Music (Jazz Studies) at the Indiana University Jacobs School of Music. Home of The Barbershop.',
  locale: 'en_US',
  repo: 'vocalsbydana/seandobbins',
};

export const NAV = [
  { href: '/music', label: 'Music' },
  { href: '/gigs', label: 'Gigs' },
  { href: '/outreach', label: 'Outreach' },
  { href: '/about', label: 'About' },
  { href: '/barbershop', label: 'The Barbershop' },
];

export function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...opts }).format(d);
}
