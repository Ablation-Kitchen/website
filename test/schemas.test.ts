import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  researchSchema,
  statusSchema,
  traceEntryId,
  traceSchema,
  workSchema,
  writingSchema,
} from '../src/lib/schemas';

const fixtures = new URL('./fixtures/traces/', import.meta.url);
const load = (sub: string) =>
  readdirSync(new URL(sub, fixtures))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(readFileSync(new URL(`${sub}/${f}`, fixtures), 'utf8'))] as const);

describe('trace schema (#10)', () => {
  it.each(load('valid'))('accepts %s', (_, data) => {
    expect(traceSchema.safeParse(data).success).toBe(true);
  });

  // Each invalid fixture must fail for its own reason, not an incidental one.
  const expected: Record<string, RegExp> = {
    'bad-recorded-at.json': /^recorded_at:/,
    'bad-role.json': /^steps\.1\.role:/,
    'bad-verdict.json': /^eval\.verdict:/,
    'first-step-not-task.json': /^steps\.0\.role: the first step must be `task`/,
    'last-step-not-pass.json': /^steps\.3\.role: the last step must be `pass`/,
    'missing-eval.json': /^eval:/,
    'pass-not-last.json': /^steps\.1\.role: `pass` may only be the last step/,
    'single-step.json': /^steps:/,
    'station-missing-slug.json': /^steps\.2\.station: `station` is required/,
    'station-on-non-station.json': /^steps\.1\.station: `station` is required/,
    'task-not-first.json': /^steps\.1\.role: `task` may only be the first step/,
    'text-too-long.json': /^steps\.1\.text:/,
    'time-goes-backwards.json': /^steps\.2\.t: `t` must not go backwards/,
    'unknown-eval-key.json': /^eval: Unrecognized key/,
    'unknown-run-key.json': /^: Unrecognized key/,
    'unknown-step-key.json': /^steps\.1: Unrecognized key/,
  };
  const invalid = load('invalid');
  it('has an expectation for every invalid fixture', () => {
    expect(invalid.map(([f]) => f).sort()).toEqual(Object.keys(expected).sort());
  });
  it.each(invalid)('rejects %s', (file, data) => {
    const result = traceSchema.safeParse(data);
    expect(result.success).toBe(false);
    const issues = result.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? [];
    expect(issues).toContainEqual(expect.stringMatching(expected[file]!));
  });
});

describe('traceEntryId', () => {
  const data = { id: 'run-01', project: 'the-brigade' };
  it('builds <project>/<run-id> from a matching path', () => {
    expect(traceEntryId('the-brigade/run-01.json', data)).toBe('the-brigade/run-01');
  });
  it('rejects a folder that disagrees with `project`', () => {
    expect(() => traceEntryId('other/run-01.json', data)).toThrow(/folder/);
  });
  it('rejects a file name that disagrees with `id`', () => {
    expect(() => traceEntryId('the-brigade/run-02.json', data)).toThrow(/file name/);
  });
  it('rejects a trace outside a project folder', () => {
    expect(() => traceEntryId('run-01.json', data)).toThrow();
  });
});

describe('writing schema', () => {
  it('accepts the first post’s frontmatter and fills defaults', () => {
    const parsed = writingSchema.parse({
      title: 'Catching Nation-State Hackers in Power Plants',
      date: '2026-11-12',
      tags: ['ics-security'],
      description: 'A casual tour.',
    });
    expect(parsed.kind).toBe('essay');
    expect(parsed.draft).toBe(false);
    expect(parsed.date).toBeInstanceOf(Date);
  });
  it('rejects an unknown field', () => {
    expect(
      writingSchema.safeParse({ title: 't', date: '2026-11-12', description: 'd', summary: 'x' })
        .success,
    ).toBe(false);
  });
  it('rejects an unknown kind', () => {
    expect(
      writingSchema.safeParse({ title: 't', date: '2026-11-12', description: 'd', kind: 'rant' })
        .success,
    ).toBe(false);
  });
});

describe('work schema', () => {
  const base = { title: 't', org: 'o', role: 'r', years: '2020–2021', summary: 's', order: 1 };
  it('defaults draft, featured, tags and metrics', () => {
    expect(workSchema.parse(base)).toMatchObject({
      draft: false,
      featured: false,
      tags: [],
      metrics: [],
    });
  });
  it('does not accept a stored course numeral', () => {
    expect(workSchema.safeParse({ ...base, course: 'i.' }).success).toBe(false);
  });
  it('rejects a non-integer order', () => {
    expect(workSchema.safeParse({ ...base, order: 1.5 }).success).toBe(false);
  });
});

describe('research schema', () => {
  const base = { title: 't', kind: 'phd', venue: 'v', blurb: 'b' };
  it('needs a date or years', () => {
    expect(researchSchema.safeParse(base).success).toBe(false);
    expect(researchSchema.safeParse({ ...base, years: '2026–2028' }).success).toBe(true);
    expect(researchSchema.safeParse({ ...base, date: '2026-01-01' }).success).toBe(true);
  });
  it('rejects a link that is not a URL', () => {
    expect(
      researchSchema.safeParse({ ...base, years: 'y', links: [{ label: 'x', href: 'nope' }] })
        .success,
    ).toBe(false);
  });
});

describe('status schema', () => {
  it('accepts an empty object', () => expect(statusSchema.parse({})).toEqual({}));
  it('rejects an unknown field', () =>
    expect(statusSchema.safeParse({ mood: 'x' }).success).toBe(false));
});
