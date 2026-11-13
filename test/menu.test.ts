import { describe, expect, it } from 'vitest';
import { feedItems, feedPaths } from '../src/lib/feed';
import { PERSON, buildMenu, type MenuInput } from '../src/lib/menu';
import { postPath } from '../src/lib/urls';
import { visibleCourses, visiblePosts } from '../src/lib/visibility-core';
import type { Research } from '../src/lib/schemas';

const SITE = 'https://ablation.kitchen';

const work = (
  id: string,
  order: number,
  opts: { draft?: boolean; metrics?: { label: string; value: string }[]; title?: string } = {},
) => ({
  id,
  data: {
    title: opts.title ?? `Course ${id}`,
    summary: `Summary of ${id}`,
    metrics: opts.metrics ?? [],
    order,
    draft: opts.draft ?? false,
  },
});

const post = (id: string, date: string, draft = false) => ({
  id,
  data: { title: `Post ${id}`, description: `About ${id}.`, date: new Date(date), draft },
});

const phd: MenuInput['research'][number] = {
  id: 'warwick-phd',
  data: {
    title: 'Topology-aware ML',
    kind: 'phd' satisfies Research['kind'],
    venue: 'University of Warwick',
    years: '2026–2028 (expected)',
    blurb: 'PhD research.',
  },
};

const menu = (overrides: Partial<MenuInput> = {}) =>
  buildMenu({ site: SITE, person: PERSON, courses: [], research: [], posts: [], ...overrides });

const linkUrls = (text: string) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);

describe('buildMenu', () => {
  it('follows the llms.txt shape: H1 name, then a > summary', () => {
    const lines = menu().split('\n');
    expect(lines[0]).toBe('# Dalmo Veras');
    expect(lines[2]).toBe(
      '> Lead AI Engineer at iCounter. Open to principal roles · Vancouver, BC.',
    );
  });

  it('puts sections in order: contact, courses, research, writing, pages', () => {
    const text = menu({
      courses: visibleCourses([work('a', 1)]),
      research: [phd],
      posts: visiblePosts([post('p', '2026-11-12')]),
    });
    const headings = text.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(['## Contact', '## Courses', '## Research', '## Writing', '## Pages']);
  });

  it('lists exactly the visible courses, numbered by position', () => {
    const courses = visibleCourses([work('b', 5), work('draft', 2, { draft: true }), work('a', 1)]);
    const lines = menu({ courses })
      .split('\n')
      .filter((l) => l.includes('/work/'));
    expect(lines).toEqual([
      '- [i. Course a](https://ablation.kitchen/work/a): Summary of a.',
      '- [ii. Course b](https://ablation.kitchen/work/b): Summary of b.',
    ]);
  });

  it('adds at most two metrics to a course', () => {
    const metrics = [
      { label: 'faster', value: '3×' },
      { label: 'saved', value: '$1M' },
      { label: 'users', value: '10k' },
    ];
    const text = menu({ courses: visibleCourses([work('a', 1, { metrics })]) });
    expect(text).toContain(': Summary of a. 3× faster; $1M saved.\n');
    expect(text).not.toContain('10k');
  });

  it('leaves out the Courses, Research and Writing sections when nothing is visible', () => {
    const text = menu({ courses: visibleCourses([work('a', 1, { draft: true })]) });
    expect(text).not.toContain('## Courses');
    expect(text).not.toContain('## Research');
    expect(text).not.toContain('## Writing');
    expect(text).not.toContain('/work/');
    expect(text).toContain('## Pages');
    expect(text).not.toMatch(/\n\n\n/);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('lists research and posts with absolute URLs', () => {
    const text = menu({ research: [phd], posts: visiblePosts([post('p', '2026-11-12')]) });
    expect(text).toContain(
      '- [Topology-aware ML](https://ablation.kitchen/research): PhD · University of Warwick · 2026–2028 (expected). PhD research.',
    );
    expect(text).toContain('- [Post p](https://ablation.kitchen/writing/p): 2026-11-12. About p.');
  });

  it('uses only absolute URLs', () => {
    const text = menu({
      courses: visibleCourses([work('a', 1)]),
      research: [phd],
      posts: visiblePosts([post('p', '2026-11-12')]),
    });
    for (const href of linkUrls(text)) expect(href).toMatch(/^(https:\/\/|mailto:)/);
  });

  it('keeps each link on one line and escapes brackets in titles', () => {
    const courses = visibleCourses([work('a', 1, { title: 'A [b]\nc' })]);
    expect(menu({ courses })).toContain('- [i. A \\[b\\] c](https://ablation.kitchen/work/a)');
  });
});

describe('feedPaths', () => {
  it('builds no /rss.xml with zero posts', () => {
    expect(feedPaths([])).toEqual([]);
  });

  it('builds no /rss.xml when every post is a draft', () => {
    expect(feedPaths([post('p', '2026-11-12', true)])).toEqual([]);
  });

  it('builds /rss.xml once a non-draft post exists', () => {
    expect(feedPaths([post('d', '2026-11-01', true), post('p', '2026-11-12')])).toEqual([
      { params: { feed: 'rss' } },
    ]);
  });
});

describe('feedItems', () => {
  it('lists non-draft posts newest first, linking to the post path', () => {
    const items = feedItems([
      post('old', '2026-01-01'),
      post('draft', '2026-12-01', true),
      post('new', '2026-11-12'),
    ]);
    expect(items.map((i) => i.link)).toEqual([postPath('new'), postPath('old')]);
    expect(postPath('new')).toBe('/writing/new');
  });
});
