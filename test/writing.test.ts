import { readFileSync } from 'node:fs';
import { createMarkdownProcessor, parseFrontmatter } from '@astrojs/markdown-remark';
import type { RootContent } from 'mdast';
import { describe, expect, it } from 'vitest';
import remarkPostTitle, {
  isPostFile,
  stripTitleHeading,
} from '../src/lib/markdown/remark-post-title';
import { navItems } from '../src/lib/seo';
import { hasWriting } from '../src/lib/visibility-core';
import {
  postDate,
  postPages,
  readingMinutes,
  wordCount,
  writingIndexPaths,
} from '../src/lib/writing';

const h = (depth: 1 | 2, text: string): RootContent => ({
  type: 'heading',
  depth,
  children: [{ type: 'text', value: text }],
});
const p = (text: string): RootContent => ({
  type: 'paragraph',
  children: [{ type: 'text', value: text }],
});

describe('stripTitleHeading', () => {
  it('drops a leading H1 that repeats the title', () => {
    const out = stripTitleHeading([h(1, 'Salt, fat'), p('Body'), h(2, 'Acid')], 'Salt, fat');
    expect(out).toEqual([p('Body'), h(2, 'Acid')]);
  });

  it('matches across case, spacing and curly quotes', () => {
    const out = stripTitleHeading([h(1, '  What I’d  cook ')], "what I'd cook");
    expect(out).toEqual([]);
  });

  it('leaves a body without an H1 alone', () => {
    const body = [p('Body'), h(2, 'Acid')];
    expect(stripTitleHeading(body, 'Salt')).toEqual(body);
  });

  it('fails on a leading H1 that is not the title', () => {
    expect(() => stripTitleHeading([h(1, 'Something else'), p('x')], 'Salt')).toThrow(
      /"# Something else"/,
    );
  });

  it('fails on a second H1 further down', () => {
    expect(() => stripTitleHeading([h(1, 'Salt'), p('x'), h(1, 'Again')], 'Salt')).toThrow(
      /"# Again"/,
    );
  });

  it('only applies to posts', () => {
    expect(isPostFile('/site/src/content/writing/a-post.md')).toBe(true);
    expect(isPostFile('/site/src/content/work/313x.mdx')).toBe(false);
    expect(isPostFile('/site/src/content/research/warwick-phd.md')).toBe(false);
  });
});

describe('the first post, through the real remark pipeline', () => {
  const file = new URL(
    '../src/content/writing/catching-nation-state-hackers-in-power-plants.md',
    import.meta.url,
  );
  const source = readFileSync(file, 'utf8');

  it('renders its body with no H1, so the page H1 is the only one', async () => {
    const { frontmatter, content } = parseFrontmatter(source);
    // The content file repeats the title as a body H1; the build must drop it.
    expect(content).toMatch(/^# /m);
    const md = await createMarkdownProcessor({ remarkPlugins: [remarkPostTitle] });
    const { code } = await md.render(content, { fileURL: file, frontmatter });
    expect(code).not.toMatch(/<h1[\s>]/);
    expect(code).toMatch(/<h2[\s>]/);
  });
});

describe('Writing appears because a non-draft post exists (#6)', () => {
  const post = (id: string, draft: boolean) => ({
    id,
    data: { draft, date: new Date('2026-11-12') },
  });

  it('with only drafts: no nav link, no /writing', () => {
    const entries = [post('a', true)];
    expect(navItems(hasWriting(entries)).map((i) => i.label)).not.toContain('Writing');
    expect(writingIndexPaths(entries)).toEqual([]);
  });

  it('with a non-draft post: the nav link and /writing', () => {
    const entries = [post('a', true), post('b', false)];
    expect(navItems(hasWriting(entries)).map((i) => i.href)).toContain('/writing');
    expect(writingIndexPaths(entries)).toEqual([{ params: { writing: 'writing' } }]);
  });

  it('pages only the visible posts, unless previewing drafts', () => {
    const entries = [post('a', true), post('b', false)];
    expect(postPages(entries, { includeDrafts: false }).map((e) => e.id)).toEqual(['b']);
    const preview = postPages(entries, { includeDrafts: true });
    expect(preview.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(preview.find((e) => e.id === 'a')?.data.draft).toBe(true);
  });
});

describe('post display helpers', () => {
  it('formats the date as a calendar day', () => {
    expect(postDate(new Date('2026-11-12'))).toBe('12 Nov 2026');
  });

  it('counts words, not code, URLs or Markdown syntax', () => {
    const md =
      '## A heading\n\nSome [linked text](https://example.com/x) here.\n\n```js\nconst x = 1;\n```\n\n- one\n';
    expect(wordCount(md)).toBe(7);
  });

  it('reads at about 230 words a minute, at least one minute', () => {
    expect(readingMinutes('word')).toBe(1);
    expect(readingMinutes(Array(2300).fill('word').join(' '))).toBe(10);
  });
});
