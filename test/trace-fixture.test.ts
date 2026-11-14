import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { projectSchema, traceEntryId, traceSchema } from '../src/lib/schemas';
import { findSecrets } from '../src/lib/trace-sanitize';
import {
  FIXTURE_MARKER,
  filesWithFixture,
  railContentBases,
  traceFixtureEnabled,
} from '../src/lib/trace-fixture';
import { projectsWithTraces } from '../src/lib/visibility-core';

const RAIL = new URL('./fixtures/rail/', import.meta.url);
const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, RAIL), 'utf8'));
const traceFiles = readdirSync(new URL('traces/', RAIL), { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.json'))
  .sort();
const projectFiles = readdirSync(new URL('projects/', RAIL)).filter((f) => f.endsWith('.json'));

describe('the rail test fixture (#37)', () => {
  it('is only read with TRACE_FIXTURE=1', () => {
    expect(traceFixtureEnabled({})).toBe(false);
    expect(traceFixtureEnabled({ TRACE_FIXTURE: '0' })).toBe(false);
    expect(traceFixtureEnabled({ TRACE_FIXTURE: '1' })).toBe(true);
    expect(railContentBases(false).traces).toBe('./src/content/traces');
    expect(railContentBases(true).traces).toBe('./test/fixtures/rail/traces');
  });

  it.each(traceFiles)('%s is a valid, clean trace whose id carries the marker', (file) => {
    const data = read(`traces/${file}`);
    expect(traceSchema.safeParse(data).success).toBe(true);
    expect(() => traceEntryId(file, data)).not.toThrow();
    expect(data.id.startsWith(FIXTURE_MARKER)).toBe(true);
    expect(findSecrets(data)).toEqual([]);
  });

  it('gives a rail of two projects, one run each, the latest for The Brigade', () => {
    const projects = projectFiles.map((f) => ({
      id: f.replace(/\.json$/, ''),
      data: projectSchema.parse(read(`projects/${f}`)),
    }));
    const traces = traceFiles.map((f) => ({
      id: f.replace(/\.json$/, ''),
      data: read(`traces/${f}`),
    }));
    const rail = projectsWithTraces(projects, traces);
    expect(rail.map((r) => [r.project.id, r.latestTrace.data.id])).toEqual([
      ['the-brigade', 'trace-fixture-002'],
      ['the-tasting-spoon', 'trace-fixture-003'],
    ]);
  });
});

describe('filesWithFixture: the build guard that keeps the fixture out of dist/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trace-fixture-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('finds the marker in built text files only', async () => {
    mkdirSync(join(dir, '_astro'));
    writeFileSync(join(dir, 'index.html'), '<p>no rail here</p>');
    writeFileSync(join(dir, 'about.html'), `<div data-run="${FIXTURE_MARKER}-002"></div>`);
    writeFileSync(join(dir, '_astro', 'chunk.js'), `const id = "${FIXTURE_MARKER}-003";`);
    writeFileSync(join(dir, 'cv.pdf'), FIXTURE_MARKER);
    expect(await filesWithFixture(dir)).toEqual(['_astro/chunk.js', 'about.html']);
  });
});
