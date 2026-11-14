/**
 * The tasting menu on /work (#32). Pure, so the unit tests run without Astro:
 * the page passes in courses from `visibleCourses()` / `coursePages()`
 * (`./visibility-core.ts`), which own the draft and numbering rules. This
 * file only shapes those courses into rows and the chaos ticket.
 */
import type { Course, Entry } from './visibility-core';
import type { Work } from './schemas';
import { coursePath } from './urls';

/** The lede under "The tasting menu", on /work and on the homepage section. */
export const TASTING_MENU_LEDE =
  'Each case study covers the scope, the decision and the alternatives, who adopted it, and the measured result.';

/** A row shows at most this many metrics (spec: /work). */
export const MENU_ROW_METRICS = 2;

type MenuCourse = Course<
  Entry<Pick<Work, 'title' | 'org' | 'years' | 'summary' | 'metrics' | 'draft'>>
>;

export interface MenuRow {
  id: string;
  href: string;
  numeral: string;
  title: string;
  /** `org · years`. */
  meta: string;
  summary: string;
  metrics: { label: string; value: string }[];
  /** Only ever true in a draft preview (`PREVIEW_DRAFTS`), where the row is badged. */
  draft: boolean;
}

/** One row per course, in the order given; numerals come from the course, never recomputed. */
export function menuRows(courses: readonly MenuCourse[]): MenuRow[] {
  return courses.map(({ id, numeral, data }) => ({
    id,
    href: coursePath(id),
    numeral,
    title: data.title,
    meta: `${data.org} · ${data.years}`,
    summary: data.summary,
    metrics: data.metrics.slice(0, MENU_ROW_METRICS),
    draft: data.draft,
  }));
}

/** The hero's tilted ticket: the course list, numeral … org, with dotted leaders. */
export function menuTicket(courses: readonly Pick<MenuCourse, 'numeral' | 'data'>[]) {
  const n = courses.length;
  return {
    header: ['tasting menu', `${n} ${n === 1 ? 'course' : 'courses'}`] as [string, string],
    items: courses.map((c) => ({ label: c.numeral, value: c.data.org })),
    footer: "chef's choice →",
  };
}
