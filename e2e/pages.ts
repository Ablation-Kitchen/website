// The pages the quality gates audit (#28). This list is the only one:
// Lighthouse CI (lighthouserc.js) and the axe suite (e2e/a11y.e2e.ts) both read it.
//
// Adding a page: when a ticket ships a page template, it adds one entry here in
// the same PR, so the page is audited from its first build. One entry per
// template is enough; for collections (case studies, posts) pick one real entry.
//
// Still to come, from the spec and #28:
//   /work                     #32
//   /research                 #34
// Later tickets also add page states to the axe suite: the ⌘K dialog (#38) and
// the trace panel (#37).
import { existsSync } from 'node:fs';

export type AuditedPage = {
  /** Short name, used in test titles and LHCI output. */
  name: string;
  /** URL path the gates load. */
  path: string;
  /** Built file under dist/ that serves this path; checked before auditing. */
  file: string;
  /** HTTP status the page answers with. Defaults to 200. */
  status?: number;
  /**
   * Issue that will build this page. While set, a missing `file` skips the page
   * with a warning instead of failing; the skip ends by itself once the file is
   * built. The ticket that builds the page removes this field.
   */
  pending?: string;
};

export const PAGES: readonly AuditedPage[] = [
  { name: 'home', path: '/', file: 'index.html' },
  { name: 'about', path: '/about', file: 'about.html' },
  // Still a draft (waits on #8): audited only in the Draft preview CI job, which
  // builds with PREVIEW_DRAFTS=1. Drop `pending` once it's published.
  {
    name: 'case-study',
    path: '/work/agent-platform',
    file: 'work/agent-platform.html',
    pending: '#8',
  },
  { name: '404', path: '/quality-gate-missing-page', file: '404.html', status: 404 },
];

const DIST = new URL('../dist/', import.meta.url);

/**
 * The pages to audit against the current dist/. Throws if a page without
 * `pending` has no built file (a page went missing, or `pnpm build` wasn't run).
 */
export function auditedPages(): AuditedPage[] {
  if (!existsSync(new URL('index.html', DIST))) {
    throw new Error('dist/ has no index.html. Run `pnpm build` first.');
  }
  return PAGES.filter((page) => {
    if (existsSync(new URL(page.file, DIST))) return true;
    if (page.pending) {
      console.warn(
        `[quality gates] skipping ${page.path}: dist/${page.file} isn't built yet (${page.pending}).`,
      );
      return false;
    }
    throw new Error(`dist/${page.file} (for ${page.path}) is missing. Run \`pnpm build\` first.`);
  });
}
