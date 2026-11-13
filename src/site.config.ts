/**
 * Hand-written site config: identity, profile links and the Person data (#7, #18).
 * The header, footer, <head> and Person JSON-LD all read from here, so the
 * name, title and links stay the same everywhere. Public repo: only public facts.
 */

export const SITE_URL = 'https://ablation.kitchen';

export const person = {
  name: 'Dalmo Veras',
  jobTitle: 'Lead AI Engineer',
  url: SITE_URL,
  email: 'dalmo@ablation.kitchen',
  worksFor: { name: 'iCounter', url: 'https://icounter.com' },
  alumniOf: { name: 'NYIT', credential: 'MSc' },
  affiliation: { name: 'University of Warwick', note: 'PhD in progress' },
} as const;

/** What Dalmo is open to, for /menu.txt and /llms.txt (#17). */
export const availability = 'principal roles · Vancouver, BC';

export const profiles = {
  linkedin: { label: 'LinkedIn', href: 'https://www.linkedin.com/in/dalmoveras' },
  github: { label: 'GitHub', href: 'https://github.com/ablationkitchen' },
} as const;

/**
 * `/cv.pdf` is committed by hand as `public/cv.pdf` (#18 amendment, #35).
 * Until that file lands, the header link 404s.
 */
export const cv = {
  href: '/cv.pdf',
  downloadName: 'CV-Dalmo-Veras-Software-Engineer-AI.pdf',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/** Plain nav labels (spec: Information architecture). Writing is added by `navItems()`. */
export const NAV: readonly NavItem[] = [
  { label: 'Work', href: '/work' },
  { label: 'Research', href: '/research' },
  { label: 'About', href: '/about' },
];

export const WRITING_NAV: NavItem = { label: 'Writing', href: '/writing' };
