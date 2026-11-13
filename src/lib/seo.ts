/**
 * Pure helpers for the layout shell: page titles, canonical URLs, nav state
 * and the Person JSON-LD. No Astro imports, so vitest runs them directly.
 */
import { NAV, WRITING_NAV, type NavItem, person, profiles, SITE_URL } from '../site.config';

const HOME_TITLE = `${person.name} — ${person.jobTitle}`;

/**
 * Title pattern (spec: Deployment → SEO): the homepage is
 * "Dalmo Veras — Lead AI Engineer"; every other page is "<Page> · Dalmo Veras".
 */
export function pageTitle(page?: string): string {
  const name = page?.trim();
  return name ? `${name} · ${person.name}` : HOME_TITLE;
}

/** Strips a trailing slash (the site uses `trailingSlash: 'never'`), except on the root. */
export function normalizePath(pathname: string): string {
  const path = pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

/** Absolute canonical URL for a path on the site, without query or hash. */
export function canonicalUrl(pathname: string, site: string = SITE_URL): string {
  return new URL(normalizePath(new URL(pathname, site).pathname), site).href;
}

/** Resolves an image path or URL against the site, for og:image. */
export function absoluteUrl(pathOrUrl: string, site: string = SITE_URL): string {
  return new URL(pathOrUrl, site).href;
}

/**
 * Header nav items. Writing sits after Work, and only when `showWriting`
 * (≥1 non-draft post, #6) is true.
 */
export function navItems(showWriting: boolean): NavItem[] {
  if (!showWriting) return [...NAV];
  const [first, ...rest] = NAV;
  return first ? [first, WRITING_NAV, ...rest] : [WRITING_NAV];
}

/**
 * Whether a nav link is the current section: an exact match, or a page under it
 * (`/work/313x` is under `/work`). The root only matches itself.
 */
export function isCurrent(pathname: string, href: string): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(href);
  if (target === '/') return path === '/';
  return path === target || path.startsWith(`${target}/`);
}

/** Person structured data (#7). */
export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    url: person.url,
    jobTitle: person.jobTitle,
    email: `mailto:${person.email}`,
    worksFor: { '@type': 'Organization', name: person.worksFor.name, url: person.worksFor.url },
    alumniOf: {
      '@type': 'CollegeOrUniversity',
      name: person.alumniOf.name,
      description: person.alumniOf.credential,
    },
    affiliation: {
      '@type': 'CollegeOrUniversity',
      name: person.affiliation.name,
      description: person.affiliation.note,
    },
    sameAs: [profiles.linkedin.href, profiles.github.href],
  };
}

/**
 * Serialises JSON-LD for a `<script type="application/ld+json">` body. `<`
 * is escaped so no string in the data can close the script element.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
