/**
 * remark plugin for case studies (`src/content/work/*.mdx`, #31).
 *
 * Authors write seven plain `## <kitchen name>` sections. This plugin checks
 * them (each of the seven exactly once, nothing else at H2, no H1, no content
 * before the first section) and regroups the document into seven
 * `<CaseSection section="…">` elements in page order: Service first (#9).
 * The page supplies `CaseSection`, which draws the heading-left row, the
 * brigade band and, in Service, "the check" (passed in as `props.check`).
 *
 * Any problem fails the build with the file name and every message. A
 * non-draft case study may not leave a section empty.
 */
import type { Heading, Root, RootContent } from 'mdast';
import type { MdxJsxAttribute, MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import { checkSectionHeadings, SECTIONS, sectionForHeading, type SectionKey } from '../case-study';

/** The parts of a VFile this plugin reads. */
interface FileLike {
  path?: string;
  data: { astro?: { frontmatter?: Record<string, unknown> } };
}

/** Nodes that render nothing: imports/exports, MDX and HTML comments, frontmatter. */
const SILENT = new Set(['mdxjsEsm', 'mdxFlowExpression', 'html', 'yaml', 'toml']);

const isSilent = (node: RootContent) => SILENT.has(node.type);

export function isCaseStudyFile(path: string | undefined): boolean {
  return !!path && /[\\/]src[\\/]content[\\/]work[\\/].+\.mdx$/.test(path);
}

function textOf(node: RootContent | Heading): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return (node.children as RootContent[]).map(textOf).join('');
  return '';
}

/** `check={props.check}`: hands the page's `<Content check={…} />` prop to the Service row. */
const CHECK_ATTRIBUTE: MdxJsxAttribute = {
  type: 'mdxJsxAttribute',
  name: 'check',
  value: {
    type: 'mdxJsxAttributeValueExpression',
    value: 'props.check',
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'MemberExpression',
              object: { type: 'Identifier', name: 'props' },
              property: { type: 'Identifier', name: 'check' },
              computed: false,
              optional: false,
            },
          },
        ],
      },
    },
  },
};

function caseSection(key: SectionKey, children: RootContent[]): MdxJsxFlowElement {
  const attributes: MdxJsxAttribute[] = [{ type: 'mdxJsxAttribute', name: 'section', value: key }];
  if (key === 'service') attributes.push(CHECK_ATTRIBUTE);
  // Section bodies are block content; the cast only widens RootContent's union.
  return {
    type: 'mdxJsxFlowElement',
    name: 'CaseSection',
    attributes,
    children: children as MdxJsxFlowElement['children'],
  };
}

/**
 * Regroups a case study's top-level nodes into the seven sections, in page
 * order. Throws one Error listing every problem.
 */
export function groupSections(
  nodes: readonly RootContent[],
  opts: { requireContent: boolean },
): RootContent[] {
  const problems: string[] = [];
  const preamble: RootContent[] = [];
  const bodies = new Map<SectionKey, RootContent[]>();
  const headings: string[] = [];
  let current: RootContent[] | undefined;

  for (const node of nodes) {
    if (node.type === 'heading' && node.depth === 1) {
      problems.push(`"# ${textOf(node)}": no H1 in the body; the page title is the H1.`);
      continue;
    }
    if (node.type === 'heading' && node.depth === 2) {
      const text = textOf(node);
      headings.push(text);
      const key = sectionForHeading(text);
      current = key && !bodies.has(key) ? [] : undefined;
      if (key && current) bodies.set(key, current);
      continue;
    }
    if (current) current.push(node);
    else if (isSilent(node)) preamble.push(node);
    else if (headings.length === 0) {
      problems.push(
        `content before the first section (a ${node.type}); start with a "## " heading.`,
      );
    }
  }

  problems.push(...checkSectionHeadings(headings));
  if (opts.requireContent) {
    for (const s of SECTIONS) {
      const body = bodies.get(s.key);
      if (body && body.every(isSilent)) {
        problems.push(`"## ${s.kitchen}" is empty; fill it or keep the case study a draft.`);
      }
    }
  }
  if (problems.length) throw new Error(problems.map((p) => `  - ${p}`).join('\n'));

  return [...preamble, ...SECTIONS.map((s) => caseSection(s.key, bodies.get(s.key) ?? []))];
}

export default function remarkCaseStudy() {
  return (tree: Root, file: FileLike) => {
    if (!isCaseStudyFile(file.path)) return;
    const draft = file.data.astro?.frontmatter?.['draft'] === true;
    try {
      tree.children = groupSections(tree.children, { requireContent: !draft });
    } catch (e) {
      throw new Error(`Case study ${file.path}:\n${(e as Error).message}`, { cause: e });
    }
  };
}
