/**
 * `/rss.xml` (#11, #40): built only once ≥1 non-draft post exists (#6). The
 * route is `src/pages/[feed].xml.ts`, so returning no static paths means no
 * file in `dist/`. Pure, so the unit tests cover the zero-post case.
 */
import type { Writing } from './schemas';
import { hasWriting, visiblePosts, type Entry } from './visibility-core';
import { postPath } from './urls';

export const FEED_TITLE = 'From the recipe book · Dalmo Veras';
export const FEED_DESCRIPTION = 'Essays, design docs and playbooks by Dalmo Veras.';

type Post = Entry<Pick<Writing, 'title' | 'description' | 'date' | 'draft'>>;

/** Static paths for `[feed].xml.ts`: `rss` when a post is visible, none otherwise. */
export function feedPaths(entries: readonly Entry<Pick<Writing, 'draft'>>[]) {
  return hasWriting(entries) ? [{ params: { feed: 'rss' } }] : [];
}

/** Feed items for the visible posts, newest first. Links are site-relative; `@astrojs/rss` resolves them. */
export function feedItems(entries: readonly Post[]) {
  return visiblePosts(entries).map((p) => ({
    title: p.data.title,
    description: p.data.description,
    pubDate: p.data.date,
    link: postPath(p.id),
  }));
}
