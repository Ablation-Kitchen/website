/**
 * Post-build step for #38: indexes the built pages with Pagefind and writes
 * the index to `dist/pagefind/`, which the ⌘K palette loads on its first open.
 *
 * Runs inside `astro build`, so every build (CI, the Draft preview, the trace
 * fixture build, a local build) ships an index; there is no separate step to
 * forget.
 *
 * What gets indexed: only a page's `<main data-pagefind-body>` (BaseLayout
 * sets it on every page that isn't `noindex`), minus anything marked
 * `data-pagefind-ignore` (nav, footer, the decorative chaos tickets, the
 * trace panel). Because pages with a body exist, Pagefind skips every page
 * without one: the 404, the dev pages, draft previews.
 *
 * Each file is added with its served URL (`about.html` → `/about`): with
 * `build.format: 'file'` Pagefind would otherwise link to `/about.html`.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import * as pagefind from 'pagefind';

/** Where the index is written under dist/: served as `/pagefind/` (`PAGEFIND_URL`, src/lib/palette.ts). */
export const PAGEFIND_DIR = 'pagefind';

/** The URL a built file is served at (`trailingSlash: 'never'`, `format: 'file'`). */
export function servedUrl(file: string): string {
  const path = file.split(sep).join('/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'/index.html'.length)}`;
  return `/${path.replace(/\.html$/, '')}`;
}

/**
 * Files Pagefind writes that the site never loads: its prebuilt UIs (the
 * palette has its own markup), the highlight script and the Web Worker (the
 * palette runs Pagefind with `noWorker`: `new Worker(url)` is a Trusted Types
 * sink, and the CSP allows one policy, for excerpts). Removed so they aren't
 * deployed.
 */
export const UNUSED_PAGEFIND_FILES = [
  'pagefind-ui.js',
  'pagefind-ui.css',
  'pagefind-modular-ui.js',
  'pagefind-modular-ui.css',
  'pagefind-component-ui.js',
  'pagefind-component-ui.css',
  'pagefind-highlight.js',
  'pagefind-worker.js',
] as const;

export default function pagefindIntegration(): AstroIntegration {
  return {
    name: 'ablation-kitchen:pagefind',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const entries = await readdir(out, { recursive: true, withFileTypes: true });
        const files = entries
          .filter((e) => e.isFile() && e.name.endsWith('.html'))
          .map((e) => relative(out, join(e.parentPath, e.name)))
          .sort();

        const { index, errors } = await pagefind.createIndex({});
        if (!index) throw new Error(`Pagefind: ${errors.join('; ')}`);
        try {
          for (const file of files) {
            const added = await index.addHTMLFile({
              url: servedUrl(file),
              content: await readFile(join(out, file), 'utf8'),
            });
            if (added.errors.length)
              throw new Error(`Pagefind (${file}): ${added.errors.join('; ')}`);
          }
          const written = await index.writeFiles({ outputPath: join(out, PAGEFIND_DIR) });
          if (written.errors.length) throw new Error(`Pagefind: ${written.errors.join('; ')}`);
          await Promise.all(
            UNUSED_PAGEFIND_FILES.map((f) => rm(join(out, PAGEFIND_DIR, f), { force: true })),
          );
          logger.info(`scanned ${files.length} built page(s); search index in /${PAGEFIND_DIR}/`);
        } finally {
          await pagefind.close();
        }
      },
    },
  };
}
