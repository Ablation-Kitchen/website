/**
 * remark plugin for posts (`src/content/writing/*.md`, #44).
 *
 * The post page renders the H1 from frontmatter `title`, so the body must not
 * add a second one. Authors often repeat the title as a leading `# …` line
 * (the first post does): that heading is dropped at build time, leaving the
 * content file as written. Any other H1 in the body fails the build, so a
 * post page always has exactly one H1.
 */
import type { Heading, Root, RootContent } from 'mdast';

/** The parts of a VFile this plugin reads. */
interface FileLike {
  path?: string;
  data: { astro?: { frontmatter?: Record<string, unknown> } };
}

/** Nodes that render nothing: frontmatter, HTML comments. */
const SILENT = new Set(['yaml', 'toml', 'html']);

export function isPostFile(path: string | undefined): boolean {
  return !!path && /[\\/]src[\\/]content[\\/]writing[\\/].+\.md$/.test(path);
}

function textOf(node: RootContent | Heading): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return (node.children as RootContent[]).map(textOf).join('');
  return '';
}

/** Title text as authors may type it: any case, curly or straight quotes, extra spaces. */
export const normalizeTitle = (text: string) =>
  text.trim().replace(/\s+/g, ' ').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').toLowerCase();

const isH1 = (node: RootContent): node is Heading => node.type === 'heading' && node.depth === 1;

/**
 * The body without a leading H1 that repeats `title`. Throws, listing each,
 * if any H1 is left (one that doesn't match, or one further down).
 */
export function stripTitleHeading(children: RootContent[], title: string): RootContent[] {
  const first = children.findIndex((n) => !SILENT.has(n.type));
  const lead = children[first];
  const out =
    lead && isH1(lead) && normalizeTitle(textOf(lead)) === normalizeTitle(title)
      ? children.filter((_, i) => i !== first)
      : children;
  const extra = out.filter(isH1).map((h) => `"# ${textOf(h)}"`);
  if (extra.length) {
    throw new Error(
      `the page's H1 is the frontmatter title, so the body may not have one: ${extra.join(', ')}. ` +
        'Use "## " for sections (a leading "# " that repeats the title is dropped).',
    );
  }
  return out;
}

export default function remarkPostTitle() {
  return (tree: Root, file: FileLike) => {
    if (!isPostFile(file.path)) return;
    const title = file.data.astro?.frontmatter?.['title'];
    if (typeof title !== 'string') return; // The schema reports a missing title.
    try {
      tree.children = stripTitleHeading(tree.children, title);
    } catch (e) {
      throw new Error(`Post ${file.path}: ${(e as Error).message}`, { cause: e });
    }
  };
}
