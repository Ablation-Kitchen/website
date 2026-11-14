/**
 * The case-study template (#9, spec: IA → Case-study page template), as data.
 *
 * Seven sections. The source may list them in kitchen flow (The order first)
 * or in page order; the page always renders them in page order, with Service
 * pulled to the top for the 30-second reader (#9, variant C).
 *
 * No Astro imports: the remark plugin, the page and the unit tests share it.
 */

export interface CaseStudySection {
  key: SectionKey;
  /** The kitchen name: the H2, and the `## …` heading in the MDX source. */
  kitchen: string;
  /** The plain meaning, shown as the mono line under the H2. */
  plain: string;
  /** Anchor id of the section on the page. */
  id: string;
  /** Italic serif letter in the sticky column: a., b., … */
  letter: string;
}

export const SECTION_KEYS = [
  'service',
  'order',
  'mise',
  'brigade',
  'tasting',
  'off',
  'differently',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const DEFS: Record<SectionKey, Omit<CaseStudySection, 'key' | 'letter'>> = {
  service: { kitchen: 'Service', plain: 'Results and impact, with numbers', id: 'service' },
  order: { kitchen: 'The order', plain: 'Problem, context, constraints, scope', id: 'the-order' },
  mise: {
    kitchen: 'Mise en place',
    plain: 'Data, tools, team, what had to be prepared',
    id: 'mise-en-place',
  },
  brigade: {
    kitchen: 'The brigade',
    plain: 'Architecture diagram and who did what',
    id: 'the-brigade',
  },
  tasting: {
    kitchen: 'Tasting notes',
    plain: 'Evals, metrics, failure modes found and fixed',
    id: 'tasting-notes',
  },
  off: {
    kitchen: 'Off the menu',
    plain: 'Alternatives considered and why they lost',
    id: 'off-the-menu',
  },
  differently: {
    kitchen: 'What I’d cook differently',
    plain: 'Honest retrospective',
    id: 'what-id-cook-differently',
  },
};

/** The seven sections in page order, each with its letter. */
export const SECTIONS: readonly CaseStudySection[] = SECTION_KEYS.map((key, i) => ({
  key,
  ...DEFS[key],
  letter: `${String.fromCharCode(97 + i)}.`,
}));

export function section(key: SectionKey): CaseStudySection {
  // SECTIONS covers every key, so this never misses.
  return SECTIONS.find((s) => s.key === key)!;
}

/** Heading text as authors may type it: any case, straight or curly apostrophe, extra spaces. */
const normalize = (text: string) =>
  text.trim().replace(/\s+/g, ' ').replace(/[’‘]/g, "'").toLowerCase();

const BY_NAME = new Map(SECTIONS.map((s) => [normalize(s.kitchen), s.key]));

/** The section an H2's text names, or undefined if it names none. */
export function sectionForHeading(text: string): SectionKey | undefined {
  return BY_NAME.get(normalize(text));
}

/**
 * Checks a case study's H2s: each of the seven exactly once, nothing else.
 * Returns one message per problem (empty when the headings are right).
 */
export function checkSectionHeadings(headings: readonly string[]): string[] {
  const problems: string[] = [];
  const seen = new Set<SectionKey>();
  for (const text of headings) {
    const key = sectionForHeading(text);
    if (!key) {
      problems.push(
        `"## ${text}" is not a case-study section. Use one of: ${SECTIONS.map((s) => s.kitchen).join(', ')}.`,
      );
    } else if (seen.has(key)) {
      problems.push(`"## ${section(key).kitchen}" appears more than once.`);
    } else {
      seen.add(key);
    }
  }
  for (const s of SECTIONS) {
    if (!seen.has(s.key)) problems.push(`missing the "## ${s.kitchen}" section.`);
  }
  return problems;
}
