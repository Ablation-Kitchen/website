/**
 * OG cards (#39, design: #19 variant B "masthead split"), as plain data.
 *
 * One card per page: an eyebrow, a serif title, a meta line and the art for
 * the 420px panel. `src/pages/og/[...slug].png.ts` renders every card in
 * `getOgCards()` (./pages.ts) to `/og/<slug>.png`; BaseLayout points each
 * page's `og:image` at its card, or at the home card when it has none (the
 * 404, any page not listed). No Astro imports, so vitest runs these directly.
 *
 * Adding a page: give it a card here (a static page goes in `STATIC_CARDS`; a
 * collection gets a builder like `courseCard`, wired up in ./pages.ts). The
 * card's `path` is the page's URL path, which is how the layout finds it.
 */
import { normalizePath } from '../seo';
import { ABOUT_PATH, RESEARCH_PATH, coursePath, postPath } from '../urls';
import { person } from '../../site.config';

/** What the 420px panel shows. One kind per template (#19). */
export type OgArt =
  /** Home (and so the default): the cubist still life. */
  | { kind: 'still-life' }
  /** /about: the split bottle. */
  | { kind: 'bottle' }
  /** /research: the ablation dot graphic. */
  | { kind: 'ablation' }
  /** /work: the course list, numeral + org. */
  | { kind: 'menu'; courses: { numeral: string; org: string }[] }
  /** A case study: the course numeral over org / years. Never metrics (#19). */
  | { kind: 'course'; numeral: string; org: string; years: string }
  /** A post: its kind and tags, like a recipe card. */
  | { kind: 'recipe'; label: string; tags: string[] };

export interface OgCard {
  /** URL path of the page the card is for, e.g. `/about`. */
  path: string;
  /** Mono line above the title. */
  eyebrow: string;
  /** Serif title, up to 3 lines; the size steps down with length. */
  title: string;
  /** Mono line under the hairline. */
  meta: string;
  art: OgArt;
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const HOME_CARD: OgCard = {
  path: '/',
  eyebrow: `${person.name} · ${person.jobTitle}`,
  title: 'I run the kitchen where agents cook.',
  meta: 'AI agents · retrieval systems · applied ML',
  art: { kind: 'still-life' },
};

/**
 * Cards for pages that aren't built from a collection. #32 adds `/work` (see
 * `workCard`).
 */
export const STATIC_CARDS: readonly OgCard[] = [
  HOME_CARD,
  {
    path: ABOUT_PATH,
    eyebrow: 'Meet the chef · about',
    title: person.name,
    meta: `${person.jobTitle}, ${person.worksFor.name} · PhD at Warwick`,
    art: { kind: 'bottle' },
  },
  {
    path: RESEARCH_PATH,
    eyebrow: 'The Ablation Lab · research',
    title: 'Take one ingredient out. Taste the difference.',
    meta: 'Ablation experiments · PhD at Warwick',
    art: { kind: 'ablation' },
  },
];

interface CourseLike {
  id: string;
  numeral: string;
  data: { title: string; org: string; role: string; years: string };
}

/** A case study's card. Only for visible courses: pages.ts never passes a draft. */
export function courseCard(course: CourseLike): OgCard {
  const { title, org, role, years } = course.data;
  return {
    path: coursePath(course.id),
    eyebrow: `Signature dishes · course ${course.numeral}`,
    title,
    meta: `${role} · ${org}`,
    art: { kind: 'course', numeral: course.numeral, org, years },
  };
}

/** The /work card, for #32: `workCard(courses)` in pages.ts once /work is built. */
export function workCard(courses: readonly CourseLike[]): OgCard {
  const first = courses[0]?.numeral;
  const last = courses.at(-1)?.numeral;
  return {
    path: '/work',
    eyebrow: 'Signature dishes · case studies',
    title: 'The tasting menu',
    meta: `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}${first && last && first !== last ? ` · ${first}–${last}` : ''}`,
    art: { kind: 'menu', courses: courses.map((c) => ({ numeral: c.numeral, org: c.data.org })) },
  };
}

interface PostLike {
  id: string;
  data: { title: string; date: Date; kind: string; tags: string[] };
}

const POST_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A post's card (eyebrow "Recipes"). Only for visible posts: pages.ts never passes a draft. */
export function postCard(post: PostLike): OgCard {
  const { title, date, kind, tags } = post.data;
  const label = kind.replace('-', ' ');
  return {
    path: postPath(post.id),
    eyebrow: 'Recipes',
    title,
    meta: `${POST_DATE.format(date)} · ${label}`,
    art: { kind: 'recipe', label, tags: tags.slice(0, 4) },
  };
}

/** `/og/<slug>.png` slug for a page path: `/` → `home`, `/work/313x` → `work/313x`. */
export function ogSlug(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? 'home' : trimmed;
}

/**
 * Site path of a card's PNG. The endpoint has its own extension, so the file
 * is `dist/og/<slug>.png` whatever `build.format` is.
 */
export const ogImagePath = (card: Pick<OgCard, 'path'>) => `/og/${ogSlug(card.path)}.png`;

/** og:image:alt for a card. */
export const ogImageAlt = (card: Pick<OgCard, 'eyebrow' | 'title'>) =>
  `ablation.kitchen · ${card.eyebrow}: ${card.title}`;

/** Throws on two cards for one path or one slug, failing the build. */
export function checkCards(cards: readonly OgCard[]): readonly OgCard[] {
  const seen = new Map<string, string>();
  for (const card of cards) {
    const slug = ogSlug(card.path);
    const prev = seen.get(slug);
    if (prev !== undefined) {
      throw new Error(`OG cards for "${prev}" and "${card.path}" share /og/${slug}.png`);
    }
    seen.set(slug, card.path);
  }
  return cards;
}

/**
 * The card for a page: its own, or the home card (the default, #19). Paths
 * are compared without a trailing slash, `index` or `.html`, so it works for
 * any `build.format`.
 */
export function cardFor(pathname: string, cards: readonly OgCard[]): OgCard {
  const path = normalizePath(pathname);
  return cards.find((c) => normalizePath(c.path) === path) ?? HOME_CARD;
}

/** Title font size in px: the longer the title, the smaller, so it fits 3 lines. */
export function titleSize(title: string): number {
  const n = title.length;
  if (n <= 20) return 96;
  if (n <= 40) return 80;
  if (n <= 64) return 68;
  if (n <= 80) return 56;
  return 48;
}
