import type { RootContent } from 'mdast';
// Registers the MDX node types (mdxjsEsm, mdxFlowExpression) on mdast's content unions.
import type {} from 'mdast-util-mdx-expression';
import type {} from 'mdast-util-mdxjs-esm';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import { describe, expect, it } from 'vitest';
import {
  checkSectionHeadings,
  SECTIONS,
  sectionForHeading,
  type SectionKey,
} from '../src/lib/case-study';
import { groupSections, isCaseStudyFile } from '../src/lib/markdown/remark-case-study';

const KITCHEN_FLOW = [
  'The order',
  'Mise en place',
  'The brigade',
  'Tasting notes',
  'Off the menu',
  'Service',
  "What I'd cook differently",
];

const h = (depth: 1 | 2 | 3, text: string): RootContent => ({
  type: 'heading',
  depth,
  children: [{ type: 'text', value: text }],
});
const p = (text: string): RootContent => ({
  type: 'paragraph',
  children: [{ type: 'text', value: text }],
});
const comment: RootContent = { type: 'mdxFlowExpression', value: '/* note */' };

/** Every section with one paragraph naming it, headings in the given order. */
const doc = (headings: readonly string[]) => headings.flatMap((t) => [h(2, t), p(`about ${t}`)]);

const sectionOf = (n: RootContent) => {
  const el = n as MdxJsxFlowElement;
  return el.attributes.find((a) => 'name' in a && a.name === 'section')?.value as SectionKey;
};

describe('SECTIONS', () => {
  it('puts Service first and letters the rows a.–g.', () => {
    expect(SECTIONS.map((s) => s.kitchen)).toEqual([
      'Service',
      'The order',
      'Mise en place',
      'The brigade',
      'Tasting notes',
      'Off the menu',
      'What I’d cook differently',
    ]);
    expect(SECTIONS.map((s) => s.letter).join(' ')).toBe('a. b. c. d. e. f. g.');
  });

  it('gives every section a unique anchor', () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(7);
  });
});

describe('sectionForHeading', () => {
  it('matches kitchen names loosely: case, spacing, straight or curly apostrophe', () => {
    expect(sectionForHeading('  the  ORDER ')).toBe('order');
    expect(sectionForHeading("What I'd cook differently")).toBe('differently');
    expect(sectionForHeading('What I’d cook differently')).toBe('differently');
    expect(sectionForHeading('Results')).toBeUndefined();
  });
});

describe('checkSectionHeadings', () => {
  it('accepts the seven in any order', () => {
    expect(checkSectionHeadings(KITCHEN_FLOW)).toEqual([]);
    expect(checkSectionHeadings(SECTIONS.map((s) => s.kitchen))).toEqual([]);
  });

  it('reports missing, duplicate and unknown sections', () => {
    const problems = checkSectionHeadings(['Service', 'Service', 'Dessert']);
    expect(problems).toContainEqual(expect.stringContaining('"## Service" appears more than once'));
    expect(problems).toContainEqual(expect.stringContaining('"## Dessert" is not a case-study'));
    expect(problems).toContainEqual(expect.stringContaining('missing the "## The order"'));
    expect(problems.filter((m) => m.startsWith('missing'))).toHaveLength(6);
  });
});

describe('groupSections', () => {
  it('wraps each section in a CaseSection, in page order, whatever the source order', () => {
    const out = groupSections(doc(KITCHEN_FLOW), { requireContent: true });
    expect(out.map(sectionOf)).toEqual(SECTIONS.map((s) => s.key));
    const service = out[0] as MdxJsxFlowElement;
    expect(service.name).toBe('CaseSection');
    expect(service.children).toEqual([p('about Service')]);
  });

  it('passes the check to Service only, as `props.check`', () => {
    const out = groupSections(doc(KITCHEN_FLOW), { requireContent: true });
    const checkAttr = (n: RootContent) =>
      (n as MdxJsxFlowElement).attributes.find((a) => 'name' in a && a.name === 'check');
    expect(checkAttr(out[0]!)?.value).toMatchObject({ value: 'props.check' });
    expect(out.slice(1).map(checkAttr)).toEqual(Array(6).fill(undefined));
  });

  it('keeps H3s and other content inside their section', () => {
    const nodes = [...doc(KITCHEN_FLOW), h(3, 'A detail'), p('more')];
    const out = groupSections(nodes, { requireContent: true });
    const differently = out.at(-1) as MdxJsxFlowElement;
    expect(differently.children).toHaveLength(3);
  });

  it('keeps comments and imports before the first section', () => {
    const esm: RootContent = { type: 'mdxjsEsm', value: "import X from './x'" };
    const out = groupSections([esm, comment, ...doc(KITCHEN_FLOW)], { requireContent: true });
    expect(out.slice(0, 2)).toEqual([esm, comment]);
    expect(out).toHaveLength(9);
  });

  it('fails on prose before the first section, an H1, or a wrong heading', () => {
    expect(() =>
      groupSections([p('intro'), ...doc(KITCHEN_FLOW)], { requireContent: false }),
    ).toThrow(/content before the first section/);
    expect(() =>
      groupSections([...doc(KITCHEN_FLOW), h(1, 'Title')], { requireContent: false }),
    ).toThrow(/no H1/);
    expect(() => groupSections(doc(KITCHEN_FLOW.slice(1)), { requireContent: false })).toThrow(
      /missing the "## The order"/,
    );
  });

  it('allows empty sections in a draft, not in a published case study', () => {
    const stub = [comment, ...KITCHEN_FLOW.map((t) => h(2, t))];
    expect(groupSections(stub, { requireContent: false })).toHaveLength(8);
    const withComment = [...KITCHEN_FLOW.flatMap((t) => [h(2, t), comment])];
    expect(() => groupSections(withComment, { requireContent: true })).toThrow(
      /"## Service" is empty/,
    );
  });
});

describe('isCaseStudyFile', () => {
  it('only claims MDX under src/content/work', () => {
    expect(isCaseStudyFile('/repo/src/content/work/agent-platform.mdx')).toBe(true);
    expect(isCaseStudyFile('C:\\repo\\src\\content\\work\\a.mdx')).toBe(true);
    expect(isCaseStudyFile('/repo/src/content/work/a.md')).toBe(false);
    expect(isCaseStudyFile('/repo/src/content/writing/a.mdx')).toBe(false);
    expect(isCaseStudyFile(undefined)).toBe(false);
  });
});
