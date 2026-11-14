/**
 * What the trace replay shows for one run (spec: Interactions → Trace replay;
 * decision #10). Pure, so the server render, the client replay and the unit
 * tests share one set of rules. The server builds a `Replay` per rail project
 * and hands it to the client as inline JSON; the client only builds DOM.
 */
import type { Trace } from './schemas';

type Step = Trace['steps'][number];
export type Verdict = Trace['eval']['verdict'];

export interface ReplayStep {
  /** `t` as `mm:ss`; minutes go past 59 with no format switch (`72:05`). */
  stamp: string;
  /** Ticket, Sous chef, the station slug in title case, or The pass. */
  label: string;
  /** Shown as a muted suffix after the label when the step has one. */
  model?: string;
  text: string;
  /** The run's verdict, on the final `pass` step only. */
  verdict?: Verdict;
  /** `Pass` or `Fail`, with `verdict`. */
  verdictLabel?: string;
  /** Wait before this step appears in the replay (0 for the first step). */
  delayMs: number;
}

export interface Replay {
  project: string;
  runId: string;
  title: string;
  verdict: Verdict;
  steps: ReplayStep[];
  /** One summary line: time · tokens · cost · verdict. A metric shows only when every step has it. */
  summary: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Seconds since the run started as `mm:ss`, rounded down. */
export function formatStamp(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** `retrieval` → `Retrieval`, `fact-check` → `Fact Check`. */
export function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

/** The display label for a step's role (#10). */
export function roleLabel(step: Pick<Step, 'role' | 'station'>): string {
  switch (step.role) {
    case 'task':
      return 'Ticket';
    case 'sous-chef':
      return 'Sous chef';
    case 'station':
      return titleCaseSlug(step.station ?? 'station');
    case 'pass':
      return 'The pass';
  }
}

export const VERDICT_LABEL: Record<Verdict, string> = { pass: 'Pass', fail: 'Fail' };

/** The compressed clock: every step after the first waits 0.6–1s, whatever its real `t`. */
export const STEP_MS = { min: 600, max: 1000 } as const;

/**
 * Wait before each step appears. The first step shows at once; each later one
 * waits between `STEP_MS.min` and `STEP_MS.max`, scaled by its real gap
 * relative to the run's longest gap, so slow steps still feel slower.
 */
export function replayDelays(ts: readonly number[]): number[] {
  const gaps = ts.map((t, i) => (i === 0 ? 0 : Math.max(0, t - ts[i - 1]!)));
  const longest = Math.max(0, ...gaps);
  const span = STEP_MS.max - STEP_MS.min;
  return gaps.map((gap, i) => {
    if (i === 0) return 0;
    const share = longest > 0 ? gap / longest : 0.5;
    return Math.round(STEP_MS.min + span * share);
  });
}

const tokensFormat = new Intl.NumberFormat('en-US');
const costFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** The sum of one metric, or undefined unless every step has it (no partial sums, no "—"). */
function total(steps: readonly Step[], key: 'tokens' | 'cost_usd'): number | undefined {
  let sum = 0;
  for (const s of steps) {
    const v = s[key];
    if (v === undefined) return undefined;
    sum += v;
  }
  return sum;
}

/**
 * The summary line's segments: the run's total time (its last step's `t`),
 * total tokens and total cost when every step has them, then the verdict.
 */
export function summarySegments(run: Pick<Trace, 'steps' | 'eval'>): string[] {
  const segments = [formatStamp(run.steps.at(-1)?.t ?? 0)];
  const tokens = total(run.steps, 'tokens');
  if (tokens !== undefined)
    segments.push(`${tokensFormat.format(tokens)} ${tokens === 1 ? 'token' : 'tokens'}`);
  const cost = total(run.steps, 'cost_usd');
  if (cost !== undefined) segments.push(costFormat.format(cost));
  segments.push(VERDICT_LABEL[run.eval.verdict]);
  return segments;
}

/** Everything the replay shows for one run. */
export function toReplay(run: Trace): Replay {
  const delays = replayDelays(run.steps.map((s) => s.t));
  return {
    project: run.project,
    runId: run.id,
    title: run.title,
    verdict: run.eval.verdict,
    steps: run.steps.map((s, i) => ({
      stamp: formatStamp(s.t),
      label: roleLabel(s),
      ...(s.model ? { model: s.model } : {}),
      text: s.text,
      ...(s.role === 'pass'
        ? { verdict: run.eval.verdict, verdictLabel: VERDICT_LABEL[run.eval.verdict] }
        : {}),
      delayMs: delays[i]!,
    })),
    summary: summarySegments(run),
  };
}

/** A project's status as card text. `in-prep` shows nothing (#6). */
export const STATUS_LABEL: Record<string, string | undefined> = {
  'on-the-fire': 'On the fire',
  shipped: 'Shipped',
};

/**
 * Inline JSON for a `<script type="application/json">` data block. `<` is
 * escaped so no value can close the script element early.
 */
export function inlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
