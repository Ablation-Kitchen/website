/**
 * `/menu.txt` and `/llms.txt` (#17): one plain-text menu of the site in the
 * llms.txt format (H1 name, `>` summary, H2 sections of `- [Title](url): line`
 * links). Pure, so the unit tests build it from fixtures; the endpoints pass
 * in content already filtered by `./visibility.ts`. A section with nothing
 * visible is left out rather than filled with a placeholder (#6).
 */
import type { Research, Work, Writing } from './schemas';
import type { Course, Entry } from './visibility-core';
import { availability, person, profiles } from '../site.config';
import { ABOUT_PATH, CV_PATH, RESEARCH_PATH, absoluteUrl, coursePath, postPath } from './urls';

export interface Person {
  name: string;
  jobTitle: string;
  worksFor: string;
  openTo: string;
  email: string;
  profiles: readonly { label: string; href: string }[];
}

/** The menu's view of the Person data; everything comes from the site config. */
export const PERSON: Person = {
  name: person.name,
  jobTitle: person.jobTitle,
  worksFor: person.worksFor.name,
  openTo: availability,
  email: person.email,
  profiles: [profiles.linkedin, profiles.github],
};

export interface MenuInput {
  site: URL | string;
  person: Person;
  /** Visible courses in menu order (`getCourses()`). */
  courses: readonly Course<Entry<Pick<Work, 'title' | 'summary' | 'metrics'>>>[];
  /** Visible research entries (`getResearch()`). */
  research: readonly Entry<
    Pick<Research, 'title' | 'kind' | 'venue' | 'blurb' | 'date' | 'years'>
  >[];
  /** Visible posts, newest first (`getPosts()`). */
  posts: readonly Entry<Pick<Writing, 'title' | 'description' | 'date'>>[];
}

const RESEARCH_KIND_LABELS: Record<Research['kind'], string> = {
  phd: 'PhD',
  paper: 'Paper',
  preprint: 'Preprint',
  talk: 'Talk',
  'open-source': 'Open source',
};

/** At most this many metrics follow a course's summary (#17). */
export const MAX_COURSE_METRICS = 2;

/** Collapse whitespace so a value can't break the one-line-per-link format. */
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Link text with Markdown brackets escaped. */
const linkText = (s: string) => oneLine(s).replace(/([[\]\\])/g, '\\$1');

const link = (title: string, href: string, note?: string) =>
  `- [${linkText(title)}](${href})${note ? `: ${oneLine(note)}` : ''}`;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const withStop = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

function section(heading: string, lines: readonly string[]): string[] {
  return lines.length ? [`## ${heading}`, '', ...lines, ''] : [];
}

export function buildMenu({ site, person, courses, research, posts }: MenuInput): string {
  const url = (path: string) => absoluteUrl(path, site);
  const home = url('/').replace(/\/$/, '');

  const courseLines = courses.map((c) => {
    const metrics = c.data.metrics
      .slice(0, MAX_COURSE_METRICS)
      .map((m) => `${oneLine(m.value)} ${oneLine(m.label)}`);
    const summary = withStop(oneLine(c.data.summary));
    return link(
      `${c.numeral} ${c.data.title}`,
      url(coursePath(c.id)),
      metrics.length ? `${summary} ${metrics.join('; ')}.` : summary,
    );
  });

  const researchLines = research.map((r) => {
    const when = r.data.date ? isoDate(r.data.date) : r.data.years;
    const meta = [RESEARCH_KIND_LABELS[r.data.kind], r.data.venue, when]
      .filter(Boolean)
      .join(' · ');
    return link(r.data.title, url(RESEARCH_PATH), `${meta}. ${withStop(oneLine(r.data.blurb))}`);
  });

  const postLines = posts.map((p) =>
    link(p.data.title, url(postPath(p.id)), `${isoDate(p.data.date)}. ${p.data.description}`),
  );

  const lines = [
    `# ${person.name}`,
    '',
    `> ${person.jobTitle} at ${person.worksFor}. Open to ${person.openTo}.`,
    '',
    `The plain-text menu of ${home}, served at ${url('/menu.txt')} and ${url('/llms.txt')}.`,
    '',
    ...section('Contact', [
      link('Email', `mailto:${person.email}`, person.email),
      ...person.profiles.map((p) => link(p.label, p.href)),
    ]),
    ...section('Courses', courseLines),
    ...section('Research', researchLines),
    ...section('Writing', postLines),
    ...section('Pages', [
      link(
        'About',
        url(ABOUT_PATH),
        `Who ${person.name} is, the kitchen rules and how to get in touch.`,
      ),
      link('CV', url(CV_PATH), 'PDF.'),
    ]),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
