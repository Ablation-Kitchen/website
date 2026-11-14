import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { traceSchema, type Trace } from '../src/lib/schemas';
import {
  STEP_MS,
  formatStamp,
  inlineJson,
  replayDelays,
  roleLabel,
  summarySegments,
  titleCaseSlug,
  toReplay,
} from '../src/lib/trace-view';

const fixture = (path: string): Trace =>
  traceSchema.parse(
    JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8')),
  );

describe('formatStamp', () => {
  it('shows seconds as mm:ss, rounded down', () => {
    expect(formatStamp(0)).toBe('00:00');
    expect(formatStamp(9.99)).toBe('00:09');
    expect(formatStamp(61)).toBe('01:01');
  });

  it('lets minutes go past 59 with no format switch', () => {
    expect(formatStamp(72 * 60 + 5)).toBe('72:05');
    expect(formatStamp(100 * 60)).toBe('100:00');
  });
});

describe('role labels (#10)', () => {
  it('maps each role to its label', () => {
    expect(roleLabel({ role: 'task' })).toBe('Ticket');
    expect(roleLabel({ role: 'sous-chef' })).toBe('Sous chef');
    expect(roleLabel({ role: 'station', station: 'retrieval' })).toBe('Retrieval');
    expect(roleLabel({ role: 'pass' })).toBe('The pass');
  });

  it('title-cases a station slug word by word', () => {
    expect(titleCaseSlug('fact-check')).toBe('Fact Check');
    expect(titleCaseSlug('tool-use-2')).toBe('Tool Use 2');
  });
});

describe('replayDelays: the compressed clock', () => {
  it('shows the first step at once and waits 0.6–1s before each later one', () => {
    const delays = replayDelays([0, 1, 50, 50.5, 3600]);
    expect(delays[0]).toBe(0);
    for (const d of delays.slice(1)) {
      expect(d).toBeGreaterThanOrEqual(STEP_MS.min);
      expect(d).toBeLessThanOrEqual(STEP_MS.max);
    }
    // The longest real gap gets the longest wait.
    expect(delays[4]).toBe(STEP_MS.max);
  });

  it('uses the middle of the range when no time passes', () => {
    expect(replayDelays([0, 0, 0])).toEqual([0, 800, 800]);
  });
});

describe('summarySegments', () => {
  it('sums tokens and cost when every step has them', () => {
    expect(summarySegments(fixture('rail/traces/the-brigade/trace-fixture-002.json'))).toEqual([
      '01:12',
      '4,420 tokens',
      '$0.0245',
      'Pass',
    ]);
  });

  it('drops a metric that any step lacks (no partial sums, no "—")', () => {
    // The task step has a cost but no tokens.
    expect(
      summarySegments(fixture('rail/traces/the-tasting-spoon/trace-fixture-003.json')),
    ).toEqual(['00:06', '$0.0091', 'Fail']);
  });

  it('shows only time and verdict when no step has metrics', () => {
    expect(summarySegments(fixture('traces/valid/minimal-fail.json'))).toEqual(
      expect.arrayContaining(['Fail']),
    );
    expect(summarySegments(fixture('traces/valid/minimal-fail.json'))).toHaveLength(2);
  });
});

describe('toReplay', () => {
  const replay = toReplay(fixture('rail/traces/the-brigade/trace-fixture-002.json'));

  it('carries the title, run id and one entry per step', () => {
    expect(replay.title).toBe('Fixture run: summarise a vendor security questionnaire');
    expect(replay.runId).toBe('trace-fixture-002');
    expect(replay.steps.map((s) => s.label)).toEqual([
      'Ticket',
      'Sous chef',
      'Retrieval',
      'Drafting',
      'Fact Check',
      'The pass',
    ]);
  });

  it('sets the model suffix only when a step has a model', () => {
    expect(replay.steps[0]).not.toHaveProperty('model');
    expect(replay.steps[2]!.model).toBe('haiku-5.5');
  });

  it('puts the verdict on the final pass step only', () => {
    expect(replay.steps.slice(0, -1).some((s) => s.verdict)).toBe(false);
    expect(replay.steps.at(-1)).toMatchObject({ verdict: 'pass', verdictLabel: 'Pass' });
  });

  it('labels a failed run as a fail', () => {
    const failed = toReplay(fixture('rail/traces/the-tasting-spoon/trace-fixture-003.json'));
    expect(failed.verdict).toBe('fail');
    expect(failed.steps.at(-1)).toMatchObject({ verdict: 'fail', verdictLabel: 'Fail' });
    expect(failed.summary.at(-1)).toBe('Fail');
  });
});

describe('inlineJson', () => {
  it('cannot close the script element it sits in', () => {
    const json = inlineJson({ text: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ text: '</script><script>alert(1)</script>' });
  });

  it('escapes line and paragraph separators', () => {
    const text = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`;
    const json = inlineJson({ text });
    expect(json).toBe('{"text":"a\\u2028b\\u2029c"}');
    expect(JSON.parse(json)).toEqual({ text });
  });
});
