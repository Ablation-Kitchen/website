import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  canonicalUrl,
  isCurrent,
  navItems,
  normalizePath,
  pageTitle,
  personJsonLd,
  serializeJsonLd,
} from '../src/lib/seo';

describe('pageTitle', () => {
  it('uses the home pattern with no page name', () => {
    expect(pageTitle()).toBe('Dalmo Veras — Lead AI Engineer');
    expect(pageTitle('  ')).toBe('Dalmo Veras — Lead AI Engineer');
  });
  it('uses "<Page> · Dalmo Veras" elsewhere', () => {
    expect(pageTitle('The tasting menu')).toBe('The tasting menu · Dalmo Veras');
    expect(pageTitle(' About ')).toBe('About · Dalmo Veras');
  });
});

describe('canonicalUrl', () => {
  it('is absolute on the production origin, without a trailing slash', () => {
    expect(canonicalUrl('/')).toBe('https://ablation.kitchen/');
    expect(canonicalUrl('/work')).toBe('https://ablation.kitchen/work');
    expect(canonicalUrl('/work/')).toBe('https://ablation.kitchen/work');
    expect(canonicalUrl('/work/313x/index.html')).toBe('https://ablation.kitchen/work/313x');
  });
  it('drops the query and hash', () => {
    expect(canonicalUrl('/about?ref=x#privacy')).toBe('https://ablation.kitchen/about');
  });
  it('ignores the host it was served from', () => {
    expect(canonicalUrl('/research', 'https://ablation.kitchen')).toBe(
      'https://ablation.kitchen/research',
    );
  });
});

describe('normalizePath', () => {
  it('keeps the root and strips trailing slashes elsewhere', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/index.html')).toBe('/');
    expect(normalizePath('/about/')).toBe('/about');
    expect(normalizePath('/about.html')).toBe('/about');
  });
});

describe('absoluteUrl', () => {
  it('resolves paths against the site and keeps absolute URLs', () => {
    expect(absoluteUrl('/og/home.png')).toBe('https://ablation.kitchen/og/home.png');
    expect(absoluteUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
  });
});

describe('navItems', () => {
  it('hides Writing until a post exists', () => {
    expect(navItems(false).map((i) => i.label)).toEqual(['Work', 'Research', 'About']);
  });
  it('puts Writing after Work once a post exists', () => {
    expect(navItems(true).map((i) => i.label)).toEqual(['Work', 'Writing', 'Research', 'About']);
  });
});

describe('isCurrent', () => {
  it('matches the section and pages under it', () => {
    expect(isCurrent('/work', '/work')).toBe(true);
    expect(isCurrent('/work/', '/work')).toBe(true);
    expect(isCurrent('/work/313x', '/work')).toBe(true);
  });
  it('does not match prefixes of other words or the root', () => {
    expect(isCurrent('/workshop', '/work')).toBe(false);
    expect(isCurrent('/work', '/')).toBe(false);
    expect(isCurrent('/', '/')).toBe(true);
  });
});

describe('personJsonLd', () => {
  it('carries the #7 Person properties', () => {
    const ld = personJsonLd();
    expect(ld).toMatchObject({
      '@type': 'Person',
      name: 'Dalmo Veras',
      url: 'https://ablation.kitchen',
      jobTitle: 'Lead AI Engineer',
      email: 'mailto:dalmo@ablation.kitchen',
      worksFor: { name: 'iCounter', url: 'https://icounter.com' },
      alumniOf: { name: 'NYIT' },
      affiliation: { name: 'University of Warwick' },
      sameAs: ['https://www.linkedin.com/in/dalmoveras', 'https://github.com/ablationkitchen'],
    });
  });
});

describe('serializeJsonLd', () => {
  it('escapes "<" so a value cannot close the script element', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
