// OG image check on the built site (#39). Run `pnpm build` first.
//
// Every built page's og:image must point at a PNG under dist/og/ that is
// 1200×630, with matching og:image:width/height and twitter:image. A draft
// case study or post must have no og:image and no card at all, which matters
// in a `PREVIEW_DRAFTS=1` build, where draft pages exist. With
// PREVIEW_DRAFTS=1 set, the check also fails if no draft page was built, so
// the draft half can't pass by checking nothing.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from '../src/site.config.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const WIDTH = 1200;
const HEIGHT = 630;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ has no index.html. Run `pnpm build` first.');
  process.exit(1);
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

/** URL paths of draft entries, read from their frontmatter: `/work/<id>`, `/writing/<id>`. */
function draftPaths(): Set<string> {
  const drafts = new Set<string>();
  for (const [collection, base] of [
    ['work', '/work'],
    ['writing', '/writing'],
  ] as const) {
    const dir = join(ROOT, 'src/content', collection);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      const match = /^(.+)\.mdx?$/.exec(file);
      if (!match) continue;
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(dir, file), 'utf8'))?.[1];
      if (frontmatter && /^draft:\s*true\s*$/m.test(frontmatter)) drafts.add(`${base}/${match[1]}`);
    }
  }
  return drafts;
}

/** `about.html` and `about/index.html` → `/about`; `index.html` → `/`. */
function pagePath(file: string): string {
  const rel = relative(DIST, file).split(sep).join('/');
  const path = `/${rel}`.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
  return path === '' ? '/' : path;
}

function meta(html: string, key: string): string | undefined {
  const tag = new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html);
  return tag?.[1]?.replaceAll('&amp;', '&');
}

/** Width and height from a PNG's IHDR chunk, or undefined if it isn't a PNG. */
function pngSize(file: string): { width: number; height: number } | undefined {
  const buf = readFileSync(file);
  const signature = '89504e470d0a1a0a';
  if (buf.subarray(0, 8).toString('hex') !== signature) return undefined;
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return undefined;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const drafts = draftPaths();
const problems: string[] = [];
let cards = 0;
let draftPages = 0;

for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
  const path = pagePath(file);
  const html = readFileSync(file, 'utf8');
  const image = meta(html, 'og:image');

  if (drafts.has(path)) {
    draftPages++;
    if (image) problems.push(`${path} is a draft but has og:image ${image}`);
    continue;
  }
  if (!image) {
    problems.push(`${path} has no og:image`);
    continue;
  }
  const prefix = `${SITE_URL}/og/`;
  if (!image.startsWith(prefix) || !image.endsWith('.png')) {
    problems.push(`${path}: og:image ${image} isn't a card under ${prefix}`);
    continue;
  }
  const png = join(DIST, 'og', image.slice(prefix.length));
  if (!existsSync(png)) {
    problems.push(`${path}: og:image ${image} has no file at dist/${relative(DIST, png)}`);
    continue;
  }
  const size = pngSize(png);
  if (!size) problems.push(`${path}: ${image} isn't a PNG`);
  else if (size.width !== WIDTH || size.height !== HEIGHT) {
    problems.push(`${path}: ${image} is ${size.width}×${size.height}, not ${WIDTH}×${HEIGHT}`);
  }
  if (
    meta(html, 'og:image:width') !== String(WIDTH) ||
    meta(html, 'og:image:height') !== String(HEIGHT)
  ) {
    problems.push(`${path}: og:image:width/height aren't ${WIDTH}/${HEIGHT}`);
  }
  if (meta(html, 'twitter:image') !== image) problems.push(`${path}: twitter:image ≠ og:image`);
  if (!meta(html, 'og:image:alt')) problems.push(`${path}: no og:image:alt`);
  cards++;
}

// No card for a draft, whether or not its page was built.
for (const path of drafts) {
  if (existsSync(join(DIST, 'og', `${path.slice(1)}.png`))) {
    problems.push(`draft ${path} has a card at dist/og${path}.png`);
  }
}

if (cards === 0) problems.push('no page with an og:image was checked');
if (process.env['PREVIEW_DRAFTS'] === '1' && drafts.size > 0 && draftPages === 0) {
  problems.push('PREVIEW_DRAFTS=1, but no draft page is built: build with it set too');
}

if (problems.length) {
  console.error(problems.map((p) => `✘ ${p}`).join('\n'));
  process.exit(1);
}
console.log(
  `✔ ${cards} page(s) with a 1200×630 og:image` +
    (draftPages ? `, ${draftPages} draft page(s) with none` : ''),
);
