/**
 * remark plugin: ```mermaid code blocks → inline SVG at build time (#11, #20, #31).
 *
 * Diagrams render in headless Chromium (Playwright, through
 * mermaid-isomorphic) while Astro builds, so the page ships plain SVG and no
 * client JS. The SVG is cleaned for the CSP by `cleanMermaidSvg` and styled
 * by `src/styles/content.css` from the colour tokens.
 *
 * It runs at the remark stage, before Expressive Code's rehype plugin, so EC
 * never sees the block. Authoring:
 *
 *   ```mermaid caption="Fig. 1 · How a request moves through the platform"
 *   flowchart LR
 *     accTitle: …            (required: the SVG's <title>)
 *     accDescr: …            (recommended: the SVG's <desc>)
 *     a[Teams] --> b[Orchestrator]
 *     class b accent         (outlines the node in the accent colour)
 *   ```
 *
 * A diagram that fails to parse, or has no accTitle/accDescr, fails the build.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ElementContent } from 'hast';
import type { Code, Root, RootContent } from 'mdast';
import { createMermaidRenderer, type MermaidRenderer } from 'mermaid-isomorphic';
import { captionFromMeta, cleanMermaidSvg } from './mermaid-svg';

interface FileLike {
  path?: string;
}

/** Labels are measured in the site's own font, so the boxes fit the text the reader sees. */
const require = createRequire(import.meta.url);
const FONT_CSS = pathToFileURL(require.resolve('@fontsource/inter-tight/latin-400.css'));

/**
 * `htmlLabels: false` keeps every label an SVG <text> (HTML labels are
 * <foreignObject> with inline styles). Colours here don't matter: the
 * stylesheet replaces them.
 */
const MERMAID_CONFIG = {
  theme: 'base',
  securityLevel: 'strict',
  htmlLabels: false,
  fontFamily: "'Inter Tight'",
  themeVariables: { fontFamily: "'Inter Tight'", fontSize: '15px' },
  flowchart: { htmlLabels: false, padding: 16, nodeSpacing: 36, rankSpacing: 56 },
} as const;

let renderer: MermaidRenderer | undefined;

function mermaidBlocks(nodes: readonly (Root | RootContent)[], out: Code[] = []): Code[] {
  for (const node of nodes) {
    if (node.type === 'code' && node.lang === 'mermaid') out.push(node);
    else if ('children' in node) mermaidBlocks(node.children, out);
  }
  return out;
}

/** Ids stay unique per page and stable across machines: derived from the file's path in the repo. */
function idPrefix(path: string | undefined): string {
  const rel = path ? relative(process.cwd(), path) : 'inline';
  return `diagram-${createHash('sha256').update(rel).digest('hex').slice(0, 8)}`;
}

export default function remarkMermaid() {
  return async (tree: Root, file: FileLike) => {
    const blocks = mermaidBlocks([tree]);
    if (blocks.length === 0) return;
    renderer ??= createMermaidRenderer();
    const results = await renderer(
      blocks.map((b) => b.value),
      { prefix: idPrefix(file.path), css: FONT_CSS, mermaidConfig: MERMAID_CONFIG },
    );

    const problems: string[] = [];
    blocks.forEach((block, i) => {
      const result = results[i];
      const where = `diagram ${i + 1} (line ${block.position?.start.line ?? '?'})`;
      if (!result || result.status === 'rejected') {
        const reason: unknown = result?.reason;
        problems.push(`${where}: ${reason instanceof Error ? reason.message : String(reason)}`);
        return;
      }
      try {
        const svg = cleanMermaidSvg(result.value.svg, result.value);
        const caption = captionFromMeta(block.meta);
        // Wide diagrams scroll sideways on phones instead of shrinking past legibility;
        // the scroller is focusable so keyboard users can scroll it too.
        const scroller: ElementContent = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['diagram-scroll'],
            tabIndex: 0,
            role: 'group',
            ariaLabel: 'Diagram',
          },
          children: [svg],
        };
        const children: ElementContent[] = [scroller];
        if (caption) {
          children.push({
            type: 'element',
            tagName: 'figcaption',
            properties: {},
            children: [{ type: 'text', value: caption }],
          });
        }
        // mdast-util-to-hast turns the code node into this <figure> instead of a <pre>.
        block.data = {
          hName: 'figure',
          hProperties: { className: ['diagram'] },
          hChildren: children,
        };
      } catch (e) {
        problems.push(`${where}: ${(e as Error).message}`);
      }
    });
    if (problems.length) {
      throw new Error(
        `Mermaid in ${file.path ?? 'a Markdown file'}:\n  - ${problems.join('\n  - ')}`,
      );
    }
  };
}
