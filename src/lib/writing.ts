/**
 * Post display helpers shared by /writing, the post page and the homepage's
 * "From the recipe book" (#44). Pure, so the unit tests run without Astro.
 */
import type { Writing } from './schemas';
import { WRITING_PATH } from './urls';
import { hasWriting, visiblePosts, type Entry } from './visibility-core';

export const KIND_LABEL: Record<Writing['kind'], string> = {
  essay: 'Essay',
  'design-doc': 'Design doc',
  playbook: 'Playbook',
};

/** "12 Nov 2026". Dates are calendar days, so format them in UTC. */
export function postDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** `2026-11-12`, for `<time datetime>`. */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const WORDS_PER_MINUTE = 230;

/** Words a reader reads in a Markdown body: no code blocks, URLs or Markdown syntax. */
export function wordCount(markdown: string): number {
  const text = markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '') // frontmatter, if passed the whole file
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/<!--[\s\S]*?-->/g, ' ') // comments
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images: keep the text
    .replace(/[#>*_`|~-]+/g, ' '); // Markdown punctuation
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Reading time in whole minutes, at least 1. */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / WORDS_PER_MINUTE));
}

/**
 * Static paths for `src/pages/[writing].astro`: `/writing` exists only once
 * ≥1 non-draft post does (#6), like `/rss.xml` (see `feedPaths`).
 */
export function writingIndexPaths(entries: readonly Entry<Pick<Writing, 'draft'>>[]) {
  return hasWriting(entries) ? [{ params: { writing: WRITING_PATH.slice(1) } }] : [];
}

/**
 * The posts that get a page, newest first. Normally the visible ones; with
 * `includeDrafts` (a preview, never the deployed build) drafts too.
 */
export function postPages<E extends Entry<Pick<Writing, 'draft' | 'date'>>>(
  entries: readonly E[],
  opts: { includeDrafts: boolean },
): E[] {
  if (!opts.includeDrafts) return visiblePosts(entries);
  const byId = new Map(entries.map((e) => [e.id, e]));
  return visiblePosts(entries.map((e) => ({ ...e, data: { ...e.data, draft: false } }))).map((e) =>
    byId.get(e.id)!,
  );
}
