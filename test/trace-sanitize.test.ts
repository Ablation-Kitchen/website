import { describe, expect, it } from 'vitest';
import {
  MASK,
  TEXT_LIMIT,
  findSecrets,
  maskSecrets,
  sanitizeRun,
  truncate,
} from '../src/lib/trace-sanitize';

// Built from parts, so this file never holds a full secret-shaped string itself.
const SECRETS: Record<string, string> = {
  'sk- API key': ['sk', 'ant-api03-AbCdEfGhIjKlMnOpQrStUv'].join('-'),
  'AWS key': ['AKIA', 'IOSFODNN7EXAMPLE'].join(''),
  'GitHub token': ['ghp', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'].join('_'),
  'Slack token': ['xoxb', '123456789012-abcdefABCDEF'].join('-'),
  'Google key': ['AIza', 'SyA1234567890abcdefghijklmnopqrstuv'].join(''),
  'bearer token': `Authorization: ${['Bearer', 'abc.def-ghi_jkl'].join(' ')}`,
  JWT: ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0In0', 'c2lnbmF0dXJlMTIz'].join('.'),
  credential: ['password', 'hunter22!'].join('='),
  'private key': [
    '-----BEGIN RSA PRIVATE KEY-----',
    'MIIEow',
    '-----END RSA PRIVATE KEY-----',
  ].join('\n'),
  email: ['chef', 'example.com'].join('@'),
  'URL with a query string': 'https://api.example.com/v1/search?q=scada&key=abc',
};

describe('maskSecrets', () => {
  it.each(Object.entries(SECRETS))('masks a %s', (_, secret) => {
    const { text, masked } = maskSecrets(`before ${secret} after`);
    expect(masked).toBeGreaterThan(0);
    expect(text).toContain(MASK);
    expect(text).not.toContain(secret);
    expect(findSecrets(text)).toEqual([]);
  });

  it('leaves ordinary trace text alone', () => {
    const plain =
      'Split into retrieval and drafting; 1,320 tokens, $0.005. See https://ablation.kitchen/work and the task-01 notes.';
    expect(maskSecrets(plain)).toEqual({ text: plain, masked: 0 });
    expect(findSecrets(plain)).toEqual([]);
  });

  it('does not flag field names such as tokens or cost', () => {
    expect(findSecrets({ tokens: 420, text: 'tokens: 420, cost: 0.004' })).toEqual([]);
  });
});

describe('truncate', () => {
  it('keeps text at or under the limit as is', () => {
    const exact = 'a'.repeat(TEXT_LIMIT);
    expect(truncate(exact)).toBe(exact);
  });

  it('cuts to 280 characters ending in an ellipsis', () => {
    const out = truncate('word '.repeat(100));
    expect(out.length).toBeLessThanOrEqual(TEXT_LIMIT);
    expect(out.endsWith('…')).toBe(true);
  });

  it('never splits a surrogate pair', () => {
    const out = truncate(`${'a'.repeat(TEXT_LIMIT - 2)}🍳🍳🍳`);
    expect(out).toBe(`${'a'.repeat(TEXT_LIMIT - 2)}…`);
  });
});

const rawRun = () => ({
  id: 'run-01',
  project: 'the-brigade',
  recorded_at: '2026-11-12T10:15:00Z',
  title: `Answer a question from ${SECRETS['email']}`,
  brigade_version: '0.3.0',
  env: { ANTHROPIC_API_KEY: SECRETS['sk- API key'] },
  steps: [
    {
      t: 0,
      role: 'task',
      text: 'Which plants run the legacy firmware?',
      prompt: 'SYSTEM: you are…',
    },
    {
      t: 1.5,
      role: 'station',
      station: 'retrieval',
      text: `Called ${SECRETS['URL with a query string']} with ${SECRETS['bearer token']}. ${'x'.repeat(400)}`,
      model: 'haiku-5.5',
      tool_payload: { raw: true },
      tokens: 900,
    },
    { t: 3, role: 'pass', text: 'Approved.' },
  ],
  eval: { verdict: 'pass', score: 0.9, judge_prompt: 'secret rubric' },
});

describe('sanitizeRun', () => {
  const { run, dropped, masked, truncated } = sanitizeRun(rawRun());

  it('keeps allowlisted schema fields only', () => {
    expect(dropped).toEqual(['env', 'steps.0.prompt', 'steps.1.tool_payload', 'eval.judge_prompt']);
    expect(run).not.toHaveProperty('env');
    expect(run.steps[1]).not.toHaveProperty('tool_payload');
    expect(run.steps[1]).toMatchObject({ station: 'retrieval', model: 'haiku-5.5', tokens: 900 });
  });

  it('masks secrets in every text field', () => {
    expect(masked).toBe(3);
    expect(run.title).toBe(`Answer a question from ${MASK}`);
    expect(findSecrets(run)).toEqual([]);
  });

  it('truncates long step text to 280 characters', () => {
    expect(truncated).toEqual([1]);
    expect(run.steps[1]!.text.length).toBeLessThanOrEqual(TEXT_LIMIT);
    expect(run.steps[1]!.text.endsWith('…')).toBe(true);
  });

  it('rejects a run the schema still refuses', () => {
    const noEval: Record<string, unknown> = rawRun();
    delete noEval['eval'];
    expect(() => sanitizeRun(noEval)).toThrow(/eval/);
    expect(() => sanitizeRun([])).toThrow(/JSON object/);
  });
});

describe('findSecrets', () => {
  it('reports the JSON path and kind without echoing the secret', () => {
    const findings = findSecrets({ steps: [{ text: 'ok' }, { text: SECRETS['AWS key'] }] });
    expect(findings).toEqual([
      { path: 'steps.1.text', kind: 'AWS access key', preview: expect.stringContaining('…') },
    ]);
    expect(JSON.stringify(findings)).not.toContain(SECRETS['AWS key']);
  });
});
