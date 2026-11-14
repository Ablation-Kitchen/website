/**
 * The Ablation Lab's "On the bench" list (/research, #34). Pure, so the unit
 * tests run without Astro: the page passes in `getResearch()` and renders
 * whatever comes back. A new non-draft file in `src/content/research/` is a
 * new row here, with no code change (the #34 done-when, tested in
 * `test/research.test.ts` and `e2e/research.e2e.ts`).
 */
import type { Research } from './schemas';
import { labTags, type Entry } from './visibility-core';

export const RESEARCH_KIND_LABELS: Record<Research['kind'], string> = {
  phd: 'PhD',
  paper: 'Paper',
  preprint: 'Preprint',
  talk: 'Talk',
  'open-source': 'Open source',
};

type ResearchEntry = Entry<
  Pick<
    Research,
    'title' | 'kind' | 'venue' | 'blurb' | 'date' | 'years' | 'links' | 'labTag' | 'draft'
  >
>;

export interface BenchEntry {
  id: string;
  kind: string;
  title: string;
  /** `venue · years`, or `venue · Mon YYYY` for a dated entry. */
  meta: string;
  blurb: string;
  /** The entry's Ablation Lab tag, under the same rules as the homepage panel (#6, #7). */
  tags: string[];
  links: { label: string; href: string }[];
}

const monthYear = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** One bench row per entry, in the order given (`getResearch()` sorts and drops drafts). */
export function benchEntries(entries: readonly ResearchEntry[]): BenchEntry[] {
  const tagsById = new Map<string, string[]>();
  for (const t of labTags(entries)) {
    tagsById.set(t.entryId, [...(tagsById.get(t.entryId) ?? []), t.label]);
  }
  return entries
    .filter((e) => !e.data.draft)
    .map(({ id, data }) => ({
      id,
      kind: RESEARCH_KIND_LABELS[data.kind],
      title: data.title,
      meta: [data.venue, data.date ? monthYear.format(data.date) : data.years]
        .filter(Boolean)
        .join(' · '),
      blurb: data.blurb,
      tags: tagsById.get(id) ?? [],
      links: data.links,
    }));
}

/**
 * The first link of the first linked preprint, for the *Too many cooks?*
 * sentence (homepage Lab panel and /research lede). Undefined until one exists.
 */
export function linkedPreprintHref(
  entries: readonly Entry<Pick<Research, 'kind' | 'draft' | 'links'>>[],
): string | undefined {
  return entries.find((e) => !e.data.draft && e.data.kind === 'preprint' && e.data.links[0])?.data
    .links[0]?.href;
}
