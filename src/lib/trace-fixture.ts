/**
 * The test fixture for the ticket rail and trace replay (#37). What's cooking
 * renders only once a real trace exists (#6), so to build, test and audit it
 * before then, a build run with `TRACE_FIXTURE=1` reads projects and traces
 * from `test/fixtures/rail/` instead of `src/content/`. Never deployed: CI's
 * deployable build runs without it, and `integrations/trace-fixture-guard.ts`
 * fails any normal build whose output contains the fixture.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export const TRACE_FIXTURE_ENV = 'TRACE_FIXTURE';

/**
 * Every fixture run id starts with this, and the replay renders the run id,
 * so a built page that holds the fixture always contains it.
 */
export const FIXTURE_MARKER = 'trace-fixture';

export function traceFixtureEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[TRACE_FIXTURE_ENV] === '1';
}

/** Where the `projects` and `traces` collections load from. */
export function railContentBases(fixture: boolean): { projects: string; traces: string } {
  return fixture
    ? { projects: './test/fixtures/rail/projects', traces: './test/fixtures/rail/traces' }
    : { projects: './src/content/projects', traces: './src/content/traces' };
}

const TEXT_FILE = /\.(html|js|mjs|css|json|txt|xml|svg|map|webmanifest)$|(^|\/)_headers$/;

/** Text files under `dir` (relative paths) that contain the fixture marker. */
export async function filesWithFixture(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const hits: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const path = join(e.parentPath, e.name);
    const rel = relative(dir, path);
    if (!TEXT_FILE.test(rel)) continue;
    if ((await readFile(path, 'utf8')).includes(FIXTURE_MARKER)) hits.push(rel);
  }
  return hits.sort();
}
