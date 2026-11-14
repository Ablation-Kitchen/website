/**
 * Which homepage sections render, and in what order (spec: IA → Homepage
 * section order; #6). Pure, so the unit tests run without Astro. The inputs
 * are what `./visibility.ts` already returns: this file only decides which
 * of those results earn a section.
 */
import { showWhatsCooking } from './visibility-core';

export const HOME_SECTIONS = [
  'hero',
  'whats-cooking',
  'tasting-menu',
  'recipe-book',
  'lab',
  'kitchen-rules',
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

export interface HomeContent {
  /** Ticket-rail projects (each with ≥1 committed trace), from `getRail()`. */
  rail: readonly unknown[];
  /** Non-draft case studies, from `getCourses()`. */
  courses: readonly unknown[];
  /** Non-draft posts, from `getPosts()`. */
  posts: readonly unknown[];
}

/**
 * The sections to render, in page order. Hero, the Ablation Lab and Kitchen
 * rules always show. What's cooking needs a project with a real trace, the
 * tasting menu a non-draft case study, the recipe book a non-draft post.
 * Nothing renders empty: no placeholders, no "coming soon".
 */
export function homepageSections(content: HomeContent): HomeSection[] {
  const shown: Record<HomeSection, boolean> = {
    hero: true,
    'whats-cooking': showWhatsCooking(content.rail),
    'tasting-menu': content.courses.length > 0,
    'recipe-book': content.posts.length > 0,
    lab: true,
    'kitchen-rules': true,
  };
  return HOME_SECTIONS.filter((s) => shown[s]);
}

/** The recipe book shows two featured posts: the newest two (posts arrive newest first). */
export function featuredPosts<P>(posts: readonly P[], count = 2): P[] {
  return posts.slice(0, count);
}

/** "See the dishes →" scrolls to the tasting menu when it is on the page, else goes to /work. */
export function dishesHref(sections: readonly HomeSection[]): string {
  return sections.includes('tasting-menu') ? '#tasting-menu' : '/work';
}
