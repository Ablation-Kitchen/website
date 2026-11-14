// /work, the tasting menu (#32). Done-when: only non-draft courses show,
// numbered with no gaps. The rule lives in `visibleCourses()`; these tests
// check the pipeline the page renders, `menuRows(visibleCourses(collection))`,
// and `e2e/work.e2e.ts` checks the built page against the real content folder.
import { describe, expect, it } from 'vitest';
import { coursePages, visibleCourses } from '../src/lib/visibility-core';
import { menuRows, menuTicket } from '../src/lib/work';

const metric = (n: number) => ({ label: `metric ${n}`, value: `${n}x` });

const course = (
  id: string,
  order: number,
  opts: { draft?: boolean; metrics?: { label: string; value: string }[] } = {},
) => ({
  id,
  data: {
    title: `Title ${id}`,
    org: `Org ${id}`,
    years: '2020–2022',
    summary: `Summary ${id}.`,
    metrics: opts.metrics ?? [],
    order,
    draft: opts.draft ?? false,
  },
});

// Out of order, with a draft and gaps in `order`.
const collection = [
  course('d', 9),
  course('a', 1, { metrics: [metric(1), metric(2), metric(3)] }),
  course('b', 2, { draft: true }),
  course('c', 5),
];

describe('/work menu rows', () => {
  const rows = menuRows(visibleCourses(collection));

  it('lists only the non-draft courses, in order, numbered with no gaps', () => {
    expect(rows.map((r) => [r.id, r.numeral])).toEqual([
      ['a', 'i.'],
      ['c', 'ii.'],
      ['d', 'iii.'],
    ]);
    expect(rows.every((r) => !r.draft)).toBe(true);
  });

  it('links each row to its case study, with `org · years`', () => {
    expect(rows[0]).toMatchObject({
      href: '/work/a',
      title: 'Title a',
      meta: 'Org a · 2020–2022',
      summary: 'Summary a.',
    });
  });

  it('shows at most two metrics', () => {
    expect(rows[0]!.metrics).toEqual([metric(1), metric(2)]);
    expect(rows[1]!.metrics).toEqual([]);
  });

  it('with no published course, has no rows', () => {
    expect(menuRows(visibleCourses([course('x', 1, { draft: true })]))).toEqual([]);
  });

  it('in a draft preview, badges drafts and numbers them as they would launch', () => {
    const preview = menuRows(coursePages(collection, { includeDrafts: true }).map((p) => p.course));
    expect(preview.map((r) => [r.id, r.numeral, r.draft])).toEqual([
      ['a', 'i.', false],
      ['b', 'ii.', true],
      ['c', 'iii.', false],
      ['d', 'iv.', false],
    ]);
  });
});

describe('/work ticket', () => {
  it('lists numeral and org per course, ending "chef’s choice →"', () => {
    expect(menuTicket(visibleCourses(collection))).toEqual({
      header: ['tasting menu', '3 courses'],
      items: [
        { label: 'i.', value: 'Org a' },
        { label: 'ii.', value: 'Org c' },
        { label: 'iii.', value: 'Org d' },
      ],
      footer: "chef's choice →",
    });
    expect(menuTicket(visibleCourses([course('a', 1)])).header).toEqual([
      'tasting menu',
      '1 course',
    ]);
  });
});
