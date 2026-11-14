import { describe, expect, it } from 'vitest';
import {
  courseNumeral,
  coursePages,
  hasLinkedPreprint,
  hasWriting,
  labTags,
  latestTrace,
  projectsWithTraces,
  showWhatsCooking,
  statusSegments,
  visibleCourses,
  visiblePosts,
} from '../src/lib/visibility-core';
import type { Research } from '../src/lib/schemas';

const course = (id: string, order: number, draft = false) => ({ id, data: { order, draft } });
const post = (id: string, date: string, draft = false) => ({
  id,
  data: { date: new Date(date), draft },
});
const trace = (id: string, project: string, recorded_at: string) => ({
  id,
  data: { project, recorded_at },
});
const project = (id: string, order: number) => ({ id, data: { order } });
const research = (
  id: string,
  kind: Research['kind'],
  opts: { draft?: boolean; labTag?: string; links?: { label: string; href: string }[] } = {},
) => ({
  id,
  data: {
    kind,
    draft: opts.draft ?? false,
    links: opts.links ?? [],
    ...(opts.labTag ? { labTag: opts.labTag } : {}),
  },
});

describe('courseNumeral', () => {
  it.each([
    [1, 'i.'],
    [2, 'ii.'],
    [3, 'iii.'],
    [4, 'iv.'],
    [5, 'v.'],
    [9, 'ix.'],
    [14, 'xiv.'],
    [40, 'xl.'],
  ])('%i → %s', (n, numeral) => expect(courseNumeral(n)).toBe(numeral));
  it('rejects 0 and fractions', () => {
    expect(() => courseNumeral(0)).toThrow();
    expect(() => courseNumeral(1.5)).toThrow();
  });
});

describe('coursePages', () => {
  const entries = [course('b', 20), course('draft', 15, true), course('a', 10), course('c', 30)];

  it('builds pages for visible courses only, each pointing at the next and wrapping', () => {
    const pages = coursePages(entries, { includeDrafts: false });
    expect(pages.map((p) => [p.course.id, p.course.numeral, p.next?.id, p.draft])).toEqual([
      ['a', 'i.', 'b', false],
      ['b', 'ii.', 'c', false],
      ['c', 'iii.', 'a', false],
    ]);
  });

  it('has no next course when there is only one', () => {
    const [only] = coursePages([course('a', 1), course('x', 2, true)], { includeDrafts: false });
    expect(only?.next).toBeUndefined();
  });

  it('in a preview, numbers drafts as if published and flags them', () => {
    const pages = coursePages(entries, { includeDrafts: true });
    expect(pages.map((p) => [p.course.id, p.course.numeral, p.draft])).toEqual([
      ['a', 'i.', false],
      ['draft', 'ii.', true],
      ['b', 'iii.', false],
      ['c', 'iv.', false],
    ]);
    expect(pages[1]?.course.data.draft).toBe(true);
  });
});

describe('visibleCourses', () => {
  it('hides drafts', () => {
    expect(visibleCourses([course('a', 1), course('b', 2, true)]).map((c) => c.id)).toEqual(['a']);
  });
  it('sorts by order and numbers by position, so gaps in order leave no gap in numerals', () => {
    const out = visibleCourses([
      course('c', 30),
      course('a', 5),
      course('draft', 7, true),
      course('b', 10),
    ]);
    expect(out.map((c) => [c.id, c.numeral])).toEqual([
      ['a', 'i.'],
      ['b', 'ii.'],
      ['c', 'iii.'],
    ]);
  });
  it('keeps the entry data', () => {
    expect(visibleCourses([course('a', 1)])[0]).toMatchObject({
      id: 'a',
      data: { order: 1 },
      numeral: 'i.',
    });
  });
  it('is empty when every course is a draft', () => {
    expect(visibleCourses([course('a', 1, true), course('b', 2, true)])).toEqual([]);
    expect(visibleCourses([])).toEqual([]);
  });
  it('throws when two visible courses share an order', () => {
    expect(() => visibleCourses([course('a', 1), course('b', 1)])).toThrow(/share order 1/);
  });
  it('allows a draft to share an order with a visible course', () => {
    expect(visibleCourses([course('a', 1), course('b', 1, true)])).toHaveLength(1);
  });
});

describe('visiblePosts / hasWriting', () => {
  it('hides drafts and sorts newest first', () => {
    const out = visiblePosts([
      post('old', '2026-01-01'),
      post('draft', '2026-12-01', true),
      post('new', '2026-06-01'),
    ]);
    expect(out.map((p) => p.id)).toEqual(['new', 'old']);
  });
  it('has writing only with a non-draft post', () => {
    expect(hasWriting([])).toBe(false);
    expect(hasWriting([post('d', '2026-01-01', true)])).toBe(false);
    expect(hasWriting([post('d', '2026-01-01', true), post('p', '2026-01-01')])).toBe(true);
  });
});

describe('latestTrace', () => {
  it('picks the latest recorded_at, comparing instants not strings', () => {
    const out = latestTrace([
      trace('p/a', 'p', '2026-11-12T10:00:00Z'),
      trace('p/b', 'p', '2026-11-12T11:30:00+02:00'), // 09:30Z, earlier
      trace('p/c', 'p', '2026-11-12T10:30:00Z'),
    ]);
    expect(out?.id).toBe('p/c');
  });
  it('breaks ties by id', () => {
    const t = '2026-11-12T10:00:00Z';
    expect(latestTrace([trace('p/b', 'p', t), trace('p/a', 'p', t)])?.id).toBe('p/b');
  });
  it('is undefined with no traces', () => expect(latestTrace([])).toBeUndefined());
});

describe('projectsWithTraces / showWhatsCooking', () => {
  const projects = [project('brigade', 1), project('second', 2), project('quiet', 3)];
  it('lists only projects with a trace, in order, with the latest run', () => {
    const rail = projectsWithTraces(projects, [
      trace('second/r1', 'second', '2026-01-01T00:00:00Z'),
      trace('brigade/r1', 'brigade', '2026-01-01T00:00:00Z'),
      trace('brigade/r2', 'brigade', '2026-02-01T00:00:00Z'),
    ]);
    expect(rail.map((r) => [r.project.id, r.latestTrace.id, r.traceCount])).toEqual([
      ['brigade', 'brigade/r2', 2],
      ['second', 'second/r1', 1],
    ]);
    expect(showWhatsCooking(rail)).toBe(true);
  });
  it('is empty with no traces, which hides What’s cooking', () => {
    const rail = projectsWithTraces(projects, []);
    expect(rail).toEqual([]);
    expect(showWhatsCooking(rail)).toBe(false);
  });
  it('throws on a trace for an unknown project', () => {
    expect(() =>
      projectsWithTraces(projects, [trace('ghost/r1', 'ghost', '2026-01-01T00:00:00Z')]),
    ).toThrow(/unknown project/);
  });
});

describe('labTags / hasLinkedPreprint', () => {
  const phdTag = 'PhD candidate · Warwick · topology-aware ML';
  const link = [{ label: 'arXiv', href: 'https://arxiv.org/abs/0000.00000' }];
  it('shows the PhD tag without a link (launch state)', () => {
    expect(labTags([research('phd', 'phd', { labTag: phdTag })])).toEqual([
      { kind: 'phd', label: phdTag, entryId: 'phd' },
    ]);
  });
  it('hides tags of drafts and entries without labTag', () => {
    expect(
      labTags([research('phd', 'phd', { labTag: phdTag, draft: true }), research('t', 'talk')]),
    ).toEqual([]);
  });
  it('needs a link for preprint and open-source tags', () => {
    const entries = [
      research('pre', 'preprint', { labTag: 'Preprint' }),
      research('oss', 'open-source', { labTag: 'Open source' }),
      research('talk', 'talk', { labTag: 'Talks' }),
    ];
    expect(labTags(entries).map((t) => t.entryId)).toEqual(['talk']);
    const linked = [research('pre', 'preprint', { labTag: 'Preprint', links: link })];
    expect(labTags(linked)).toEqual([
      { kind: 'preprint', label: 'Preprint', entryId: 'pre', href: link[0]!.href },
    ]);
  });
  it('shows Too many cooks? only with a linked, non-draft preprint', () => {
    expect(hasLinkedPreprint([research('phd', 'phd', { labTag: phdTag })])).toBe(false);
    expect(hasLinkedPreprint([research('pre', 'preprint')])).toBe(false);
    expect(hasLinkedPreprint([research('pre', 'preprint', { links: link, draft: true })])).toBe(
      false,
    );
    expect(hasLinkedPreprint([research('pre', 'preprint', { links: link })])).toBe(true);
  });
});

describe('statusSegments', () => {
  it('renders only set fields, in display order', () => {
    expect(statusSegments({ reading: 'A book', cooking: 'The Brigade' })).toEqual([
      { key: 'cooking', label: 'Cooking', value: 'The Brigade' },
      { key: 'reading', label: 'Reading', value: 'A book' },
    ]);
  });
  it('is empty for an empty or missing status', () => {
    expect(statusSegments({})).toEqual([]);
    expect(statusSegments(undefined)).toEqual([]);
  });
});
