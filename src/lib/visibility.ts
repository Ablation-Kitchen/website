/**
 * The one place launch gating lives. Every page, `/menu.txt`, `/llms.txt`,
 * RSS and the OG endpoint read content through these wrappers. The rules
 * themselves are pure and tested in `./visibility-core.ts`.
 */
import { getCollection, getEntry } from 'astro:content';
import {
  coursePages,
  hasLinkedPreprint,
  hasWriting,
  labTags,
  projectsWithTraces,
  showWhatsCooking,
  statusSegments,
  visibleCourses,
  visiblePosts,
  visibleResearch,
} from './visibility-core';

export * from './visibility-core';

/** Non-draft case studies in menu order, with course numerals. */
export async function getCourses() {
  return visibleCourses(await getCollection('work'));
}

/**
 * Drafts get preview pages in `astro dev`, or in a build run with
 * `PREVIEW_DRAFTS=1` (for checking a draft locally, never deployed: CI builds
 * without it). Everywhere else drafts stay hidden.
 */
export const PREVIEW_DRAFTS = import.meta.env.DEV || process.env['PREVIEW_DRAFTS'] === '1';

/** One page per case study, with its "Next course" (drafts only in a preview). */
export async function getCoursePages() {
  return coursePages(await getCollection('work'), { includeDrafts: PREVIEW_DRAFTS });
}

/** Non-draft posts, newest first. */
export async function getPosts() {
  return visiblePosts(await getCollection('writing'));
}

export async function getHasWriting() {
  return hasWriting(await getCollection('writing'));
}

/** Ticket-rail projects (≥1 trace each), with the latest run to replay. */
export async function getRail() {
  const [projects, traces] = await Promise.all([
    getCollection('projects'),
    getCollection('traces'),
  ]);
  return projectsWithTraces(projects, traces);
}

export async function getShowWhatsCooking() {
  return showWhatsCooking(await getRail());
}

/** Non-draft research entries in date order (newest first; spans without a date last). */
export async function getResearch() {
  return visibleResearch(await getCollection('research'));
}

export async function getLab() {
  const entries = await getCollection('research');
  return { tags: labTags(entries), tooManyCooks: hasLinkedPreprint(entries) };
}

export async function getStatusSegments() {
  return statusSegments((await getEntry('status', 'current'))?.data);
}
