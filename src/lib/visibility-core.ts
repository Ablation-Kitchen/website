/**
 * Launch visibility rules (#6, #7, #10), as pure functions over plain
 * `{ id, data }` entries. No Astro imports, so the unit tests run without it.
 * Pages, `/menu.txt`, RSS and the OG endpoint use these through
 * `./visibility.ts`; nothing re-implements a rule.
 */
import type { Project, Research, Status, Trace, Work, Writing } from './schemas';

export interface Entry<D> {
  id: string;
  data: D;
}

type Draftable = { draft: boolean };

const isPublished = <E extends Entry<Draftable>>(e: E) => !e.data.draft;

const ROMAN: ReadonlyArray<readonly [number, string]> = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

/** Course numeral for a 1-based position: 1 → "i.", 4 → "iv.". */
export function courseNumeral(position: number): string {
  if (!Number.isInteger(position) || position < 1)
    throw new RangeError(`no numeral for ${position}`);
  let n = position;
  let out = '';
  for (const [value, letters] of ROMAN) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return `${out}.`;
}

export type Course<E> = E & { numeral: string };

/**
 * Non-draft case studies sorted by `order`, each with its course numeral.
 * Numerals follow position, not `order`, so drafts and gaps in `order`
 * never leave a gap in the menu. Two visible courses sharing an `order`
 * throw, failing the build.
 */
export function visibleCourses<E extends Entry<Pick<Work, 'draft' | 'order'>>>(
  entries: readonly E[],
): Course<E>[] {
  const sorted = entries.filter(isPublished).sort((a, b) => a.data.order - b.data.order);
  sorted.forEach((e, i) => {
    const prev = sorted[i - 1];
    if (prev && prev.data.order === e.data.order) {
      throw new Error(`case studies "${prev.id}" and "${e.id}" share order ${e.data.order}`);
    }
  });
  return sorted.map((e, i) => ({ ...e, numeral: courseNumeral(i + 1) }));
}

export type CoursePage<E> = {
  course: Course<E>;
  /** The course after this one, wrapping to the first; none when it's the only course. */
  next: Course<E> | undefined;
  /** True for a draft shown only in a preview (dev, or `PREVIEW_DRAFTS=1`). */
  draft: boolean;
};

/**
 * One page per case study (`/work/<id>`), with its "Next course". Normally
 * only the visible courses. With `includeDrafts` (a preview, never the
 * deployed build) drafts get pages too, numbered as if they were published,
 * so a draft previews with the numeral it will launch with.
 */
export function coursePages<E extends Entry<Pick<Work, 'draft' | 'order'>>>(
  entries: readonly E[],
  opts: { includeDrafts: boolean },
): CoursePage<E>[] {
  const courses = opts.includeDrafts
    ? visibleCourses(entries.map((e) => ({ ...e, data: { ...e.data, draft: false } }))).map(
        (c) => ({ ...entries.find((e) => e.id === c.id)!, numeral: c.numeral }),
      )
    : visibleCourses(entries);
  return courses.map((course, i) => ({
    course,
    next: courses.length > 1 ? courses[(i + 1) % courses.length] : undefined,
    draft: course.data.draft,
  }));
}

/** Non-draft posts, newest first (ties by id, for a stable order). */
export function visiblePosts<E extends Entry<Pick<Writing, 'draft' | 'date'>>>(
  entries: readonly E[],
): E[] {
  return entries
    .filter(isPublished)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}

/** Writing (nav link, homepage section, /writing, /rss.xml) exists once ≥1 non-draft post does. */
export function hasWriting(entries: readonly Entry<Pick<Writing, 'draft'>>[]): boolean {
  return entries.some(isPublished);
}

type TraceLike = Entry<Pick<Trace, 'project' | 'recorded_at'>>;

/** The run to replay: latest `recorded_at`; ties go to the greater id. Undefined for no traces. */
export function latestTrace<T extends TraceLike>(traces: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestTime = -Infinity;
  for (const t of traces) {
    const time = Date.parse(t.data.recorded_at);
    if (time > bestTime || (time === bestTime && best && t.id > best.id)) {
      best = t;
      bestTime = time;
    }
  }
  return best;
}

export interface RailProject<P, T> {
  project: P;
  latestTrace: T;
  traceCount: number;
}

/**
 * Projects for the ticket rail: only those with ≥1 committed trace, sorted by
 * `order`, each with the run to replay. A trace naming an unknown project
 * throws, failing the build.
 */
export function projectsWithTraces<P extends Entry<Pick<Project, 'order'>>, T extends TraceLike>(
  projects: readonly P[],
  traces: readonly T[],
): RailProject<P, T>[] {
  const known = new Set(projects.map((p) => p.id));
  for (const t of traces) {
    if (!known.has(t.data.project)) {
      throw new Error(`trace "${t.id}" names unknown project "${t.data.project}"`);
    }
  }
  return [...projects]
    .sort((a, b) => a.data.order - b.data.order)
    .flatMap((project) => {
      const own = traces.filter((t) => t.data.project === project.id);
      const latest = latestTrace(own);
      return latest ? [{ project, latestTrace: latest, traceCount: own.length }] : [];
    });
}

/** What's cooking (ticket rail + replay) renders only once a project has a real trace. */
export function showWhatsCooking(rail: readonly unknown[]): boolean {
  return rail.length > 0;
}

export interface LabTag {
  kind: Research['kind'];
  label: string;
  /** First link of the entry, when it has one. */
  href?: string;
  entryId: string;
}

/** Kinds whose tag may show without a link (the PhD; a talk once it exists). */
const LINK_OPTIONAL: ReadonlySet<Research['kind']> = new Set(['phd', 'talk']);

/**
 * Tags for the homepage Ablation Lab (#6, #7). A non-draft entry with a
 * `labTag` contributes its tag; preprints, papers and open-source entries
 * also need a link (a public preprint, a public repo). Entry order is kept.
 */
export function labTags(
  entries: readonly Entry<Pick<Research, 'kind' | 'draft' | 'labTag' | 'links'>>[],
): LabTag[] {
  return entries.filter(isPublished).flatMap((e) => {
    const { kind, labTag, links } = e.data;
    if (!labTag) return [];
    const href = links[0]?.href;
    if (!href && !LINK_OPTIONAL.has(kind)) return [];
    return [{ kind, label: labTag, entryId: e.id, ...(href ? { href } : {}) }];
  });
}

/** The *Too many cooks?* sentence shows only once there is a linked preprint to point at. */
export function hasLinkedPreprint(
  entries: readonly Entry<Pick<Research, 'kind' | 'draft' | 'links'>>[],
): boolean {
  return entries.some(
    (e) => !e.data.draft && e.data.kind === 'preprint' && e.data.links.length > 0,
  );
}

export interface StatusSegment {
  key: keyof Status;
  label: string;
  value: string;
}

const STATUS_LABELS: Record<keyof Status, string> = {
  cooking: 'Cooking',
  lastShipped: 'Last shipped',
  reading: 'Reading',
};

/** Status strip segments, in display order, for set fields only. The static "yes, chef" is not data. */
export function statusSegments(status: Status | undefined): StatusSegment[] {
  if (!status) return [];
  return (Object.keys(STATUS_LABELS) as (keyof Status)[]).flatMap((key) => {
    const value = status[key]?.trim();
    return value ? [{ key, label: STATUS_LABELS[key], value }] : [];
  });
}
