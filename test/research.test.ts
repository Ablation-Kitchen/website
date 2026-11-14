// /research (#34). Done-when: new `research/` entries appear without code
// changes. Here that's a property of the pure pipeline the page renders,
// `benchEntries(visibleResearch(collection))`: whatever valid entries the
// collection holds come out as bench rows. `e2e/research.e2e.ts` checks the
// built page against the real content folder.
import { describe, expect, it } from 'vitest';
import { RESEARCH_KIND_LABELS, benchEntries, linkedPreprintHref } from '../src/lib/research';
import { researchKinds, researchSchema, type Research } from '../src/lib/schemas';
import { visibleResearch } from '../src/lib/visibility-core';

const entry = (id: string, data: Record<string, unknown>) => ({
  id,
  data: researchSchema.parse({ venue: 'Somewhere', blurb: 'A blurb.', ...data }) as Research,
});

const phd = entry('warwick-phd', {
  title: 'Topology-aware ML',
  kind: 'phd',
  years: '2026–2028 (expected)',
  venue: 'University of Warwick · Computer Science',
  labTag: 'PhD candidate · Warwick · topology-aware ML',
});

const bench = (entries: ReturnType<typeof entry>[]) => benchEntries(visibleResearch(entries));

describe('/research bench', () => {
  it('at launch: the PhD as the only entry, with its Lab tag', () => {
    expect(bench([phd])).toEqual([
      {
        id: 'warwick-phd',
        kind: 'PhD',
        title: 'Topology-aware ML',
        meta: 'University of Warwick · Computer Science · 2026–2028 (expected)',
        blurb: 'A blurb.',
        tags: ['PhD candidate · Warwick · topology-aware ML'],
        links: [],
      },
    ]);
  });

  it('a new entry of any kind becomes a row, with no other change', () => {
    for (const kind of researchKinds) {
      const added = entry(`new-${kind}`, { title: `New ${kind}`, kind, date: '2027-03-01' });
      const rows = bench([phd, added]);
      expect(rows.map((r) => r.id)).toEqual([`new-${kind}`, 'warwick-phd']);
      expect(rows[0]).toMatchObject({
        kind: RESEARCH_KIND_LABELS[kind],
        title: `New ${kind}`,
        meta: 'Somewhere · Mar 2027',
      });
    }
  });

  it('drafts stay off the bench', () => {
    const draft = entry('wip', { title: 'WIP', kind: 'preprint', date: '2027-01-01', draft: true });
    expect(bench([phd, draft]).map((r) => r.id)).toEqual(['warwick-phd']);
    expect(benchEntries([draft])).toEqual([]);
  });

  it('orders dated entries newest first, then spans, ties by id', () => {
    const a = entry('a', { title: 'A', kind: 'talk', date: '2027-01-01' });
    const b = entry('b', { title: 'B', kind: 'paper', date: '2027-06-01' });
    const c = entry('c', { title: 'C', kind: 'paper', date: '2027-06-01' });
    const span = entry('aa-span', { title: 'Span', kind: 'phd', years: '2026–2028' });
    expect(bench([phd, a, span, c, b]).map((r) => r.id)).toEqual([
      'b',
      'c',
      'a',
      'aa-span',
      'warwick-phd',
    ]);
  });

  it('shows links, and a preprint’s Lab tag only once it has one (#6, #7)', () => {
    const arxiv = { label: 'arXiv', href: 'https://arxiv.org/abs/0000.00000' };
    const unlinked = entry('cooks', {
      title: 'Too many cooks?',
      kind: 'preprint',
      date: '2027-02-01',
      labTag: 'arXiv preprint',
    });
    expect(bench([unlinked])[0]).toMatchObject({ tags: [], links: [] });
    const linked = entry('cooks', { ...unlinked.data, links: [arxiv] });
    expect(bench([linked])[0]).toMatchObject({ tags: ['arXiv preprint'], links: [arxiv] });
  });
});

describe('linkedPreprintHref', () => {
  const arxiv = { label: 'arXiv', href: 'https://arxiv.org/abs/0000.00000' };
  it('is undefined until a non-draft preprint has a link', () => {
    expect(linkedPreprintHref([phd])).toBeUndefined();
    const pre = entry('p', { title: 'P', kind: 'preprint', date: '2027-01-01' });
    expect(linkedPreprintHref([pre])).toBeUndefined();
    const draft = entry('p', { ...pre.data, links: [arxiv], draft: true });
    expect(linkedPreprintHref([draft])).toBeUndefined();
  });
  it('is the first link of the first linked preprint', () => {
    const pre = entry('p', { title: 'P', kind: 'preprint', date: '2027-01-01', links: [arxiv] });
    expect(linkedPreprintHref([phd, pre])).toBe(arxiv.href);
  });
});
