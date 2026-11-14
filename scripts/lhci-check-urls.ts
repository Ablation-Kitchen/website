// Runs after `lhci autorun` (#28). LHCI matches its per-page assertions on the
// URL a page ends up at, so a listed path that redirects (e.g. /about → /about/)
// would match no assertions and pass unchecked. This fails if any run ended on
// a different URL than it asked for, or if a listed page has no runs.
import { readdirSync, readFileSync } from 'node:fs';
import { auditedPages } from '../e2e/pages.ts';

const DIR = new URL('../.lighthouseci/', import.meta.url);

type Lhr = { requestedUrl: string; finalDisplayedUrl: string };
const lhrs: Lhr[] = readdirSync(DIR)
  .filter((f) => /^lhr-.*\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Lhr);

const problems = new Set<string>();
for (const { requestedUrl, finalDisplayedUrl } of lhrs) {
  if (requestedUrl !== finalDisplayedUrl) {
    problems.add(`${requestedUrl} redirected to ${finalDisplayedUrl}: its assertions never ran`);
  }
}
for (const { path } of auditedPages()) {
  if (!lhrs.some((l) => new URL(l.requestedUrl).pathname === path)) {
    problems.add(`${path} has no Lighthouse run`);
  }
}

if (problems.size) {
  console.error([...problems].map((p) => `✘ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${lhrs.length} Lighthouse run(s), none redirected.`);
