/**
 * Build assertion for #37: the test fixture trace never ships. A normal build
 * fails if any file in `dist/` contains the fixture marker. A fixture build
 * (`TRACE_FIXTURE=1`) must contain it on the homepage, so the marker check
 * can't silently go stale; it also warns that the output is not deployable.
 */
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import {
  FIXTURE_MARKER,
  TRACE_FIXTURE_ENV,
  filesWithFixture,
  traceFixtureEnabled,
} from '../src/lib/trace-fixture.ts';

export default function traceFixtureGuard(): AstroIntegration {
  return {
    name: 'ablation-kitchen:trace-fixture-guard',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        if (traceFixtureEnabled()) {
          const home = await readFile(join(out, 'index.html'), 'utf8');
          if (!home.includes(FIXTURE_MARKER)) {
            throw new Error(
              `${TRACE_FIXTURE_ENV}=1, but the homepage has no fixture trace ("${FIXTURE_MARKER}"). Check test/fixtures/rail/.`,
            );
          }
          logger.warn(
            `${TRACE_FIXTURE_ENV}=1: this build holds the test fixture trace. Never deploy it.`,
          );
          return;
        }
        const leaks = await filesWithFixture(out);
        if (leaks.length) {
          throw new Error(
            `The test fixture trace ("${FIXTURE_MARKER}") is in the build output:\n${leaks.join('\n')}`,
          );
        }
        logger.info('no fixture trace in the build output');
      },
    },
  };
}
