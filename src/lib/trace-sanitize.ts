/**
 * Trace sanitising and the secret check (decision #10, #37). Pure, so the
 * CLIs (`pnpm trace:sanitize`, `pnpm trace:scan`) and the unit tests share
 * one set of rules:
 *
 * - keep only the schema's fields (raw prompts, tool payloads, env and
 *   anything else are dropped);
 * - mask secret-like strings: API keys, bearer tokens, credentials,
 *   private keys, JWTs, emails and URLs with a query string;
 * - truncate each step's `text` to 280 characters, ending in an ellipsis.
 *
 * The CI scan runs `findSecrets` over every committed trace and fails on any
 * match, so a trace committed without `trace:sanitize` can't ship a secret.
 */
import { traceSchema, type Trace } from './schemas.ts';

export const TEXT_LIMIT = 280;
export const MASK = '[redacted]';
const ELLIPSIS = '…';

export interface SecretPattern {
  name: string;
  pattern: RegExp;
}

/** Ordered: longer, more specific shapes first, so they're masked whole. */
export const SECRET_PATTERNS: readonly SecretPattern[] = [
  {
    name: 'private key',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  },
  { name: 'bearer token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi },
  { name: 'API key (sk-…)', pattern: /\bsk-[A-Za-z0-9_-]{16,}/g },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  {
    name: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/g,
  },
  { name: 'Slack token', pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}/g },
  { name: 'JWT', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  {
    name: 'credential',
    pattern:
      /\b(?:api[_-]?key|access[_-]?key|secret|token|password|passwd)\s*[:=]\s*["']?(?!\[redacted\])[^\s"',;]{6,}/gi,
  },
  { name: 'email', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { name: 'URL with a query string', pattern: /\bhttps?:\/\/[^\s?#"'<>]+\?[^\s"'<>]+/gi },
];

/** Masks every secret-like match in `text`. */
export function maskSecrets(text: string): { text: string; masked: number } {
  let masked = 0;
  let out = text;
  for (const { pattern } of SECRET_PATTERNS) {
    out = out.replace(pattern, () => {
      masked++;
      return MASK;
    });
  }
  return { text: out, masked };
}

/** Cuts `text` to `limit` characters, the last being an ellipsis. Never splits a surrogate pair. */
export function truncate(text: string, limit = TEXT_LIMIT): string {
  if (text.length <= limit) return text;
  let cut = text.slice(0, limit - ELLIPSIS.length);
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}${ELLIPSIS}`;
}

const RUN_KEYS = ['id', 'project', 'recorded_at', 'title', 'brigade_version', 'steps', 'eval'];
const STEP_KEYS = ['t', 'role', 'station', 'text', 'model', 'tokens', 'latency_ms', 'cost_usd'];
const EVAL_KEYS = ['verdict', 'score', 'note'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(obj: Obj, keys: readonly string[], where: string, dropped: string[]): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(obj)) {
    if (keys.includes(k)) out[k] = v;
    else dropped.push(`${where}${k}`);
  }
  return out;
}

export interface SanitizeResult {
  run: Trace;
  /** Paths of the fields that were dropped, e.g. `steps.2.prompt`. */
  dropped: string[];
  masked: number;
  /** Indexes of the steps whose text was truncated. */
  truncated: number[];
}

/**
 * A raw run export → a trace ready to commit. Throws if what's left still
 * fails the schema (e.g. a missing `eval`), listing the schema's issues.
 */
export function sanitizeRun(raw: unknown): SanitizeResult {
  if (!isObj(raw)) throw new Error('a trace must be a JSON object');
  const dropped: string[] = [];
  const truncated: number[] = [];
  let masked = 0;
  const mask = (v: unknown) => {
    if (typeof v !== 'string') return v;
    const r = maskSecrets(v);
    masked += r.masked;
    return r.text;
  };

  const run = pick(raw, RUN_KEYS, '', dropped);
  run['title'] = mask(run['title']);
  run['brigade_version'] = mask(run['brigade_version']);
  if (Array.isArray(run['steps'])) {
    run['steps'] = run['steps'].map((s, i) => {
      if (!isObj(s)) return s;
      const step = pick(s, STEP_KEYS, `steps.${i}.`, dropped);
      step['model'] = mask(step['model']);
      if (step['model'] === undefined) delete step['model'];
      if (typeof step['text'] === 'string') {
        const text = mask(step['text']) as string;
        const short = truncate(text);
        if (short !== text) truncated.push(i);
        step['text'] = short;
      }
      return step;
    });
  }
  if (isObj(run['eval'])) {
    const ev = pick(run['eval'], EVAL_KEYS, 'eval.', dropped);
    if (ev['note'] !== undefined) ev['note'] = mask(ev['note']);
    run['eval'] = ev;
  }

  const parsed = traceSchema.safeParse(run);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`the sanitised trace is still invalid:\n${issues.join('\n')}`);
  }
  return { run: parsed.data, dropped, masked, truncated };
}

export interface SecretFinding {
  /** JSON path of the string, e.g. `steps.3.text`. */
  path: string;
  kind: string;
  /** The match with its middle hidden, so the report doesn't leak it again. */
  preview: string;
}

const hide = (s: string) => (s.length <= 8 ? '****' : `${s.slice(0, 4)}…${s.slice(-2)}`);

/** Every secret-like string anywhere in a parsed JSON value. Empty when clean. */
export function findSecrets(value: unknown, path = ''): SecretFinding[] {
  if (typeof value === 'string') {
    return SECRET_PATTERNS.flatMap(({ name, pattern }) =>
      [...value.matchAll(new RegExp(pattern.source, pattern.flags))].map((m) => ({
        path: path || '(root)',
        kind: name,
        preview: hide(m[0]),
      })),
    );
  }
  const join = (k: string | number) => (path ? `${path}.${k}` : String(k));
  if (Array.isArray(value)) return value.flatMap((v, i) => findSecrets(v, join(i)));
  if (isObj(value)) return Object.entries(value).flatMap(([k, v]) => findSecrets(v, join(k)));
  return [];
}
