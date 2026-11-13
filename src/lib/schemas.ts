/**
 * Zod schemas for every content collection.
 *
 * Kept free of `astro:content` so the unit tests can import them without
 * Astro. `src/content.config.ts` wires them to loaders. Every object is
 * strict: an unknown or misspelt field fails the build.
 */
import { z } from 'astro/zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase kebab-case slug');

const tags = z.array(z.string().min(1)).default([]);

/** Case studies (courses on the tasting menu). The course numeral is derived from `order`, never stored. */
export const workSchema = z.strictObject({
  title: z.string().min(1),
  org: z.string().min(1),
  role: z.string().min(1),
  years: z.string().min(1),
  summary: z.string().min(1),
  tags,
  metrics: z
    .array(z.strictObject({ label: z.string().min(1), value: z.string().min(1) }))
    .default([]),
  featured: z.boolean().default(false),
  order: z.number().int().positive(),
  draft: z.boolean().default(false),
});

/** Posts (the recipe book). */
export const writingSchema = z.strictObject({
  title: z.string().min(1),
  date: z.coerce.date(),
  description: z.string().min(1),
  tags,
  kind: z.enum(['essay', 'design-doc', 'playbook']).default('essay'),
  draft: z.boolean().default(false),
});

export const researchKinds = ['phd', 'paper', 'preprint', 'talk', 'open-source'] as const;

/** Ablation Lab entries. */
export const researchSchema = z
  .strictObject({
    title: z.string().min(1),
    kind: z.enum(researchKinds),
    /** A single date (paper, preprint, talk). */
    date: z.coerce.date().optional(),
    /** A span (e.g. a PhD: "2026–2028 (expected)"). */
    years: z.string().min(1).optional(),
    venue: z.string().min(1),
    blurb: z.string().min(1),
    tags,
    links: z.array(z.strictObject({ label: z.string().min(1), href: z.url() })).default([]),
    /** Text of the tag this entry contributes to the homepage Ablation Lab, if any. */
    labTag: z.string().min(1).optional(),
    draft: z.boolean().default(false),
  })
  .refine((r) => r.date !== undefined || r.years !== undefined, {
    message: 'set `date` or `years`',
    path: ['date'],
  });

export const projectStatuses = ['on-the-fire', 'in-prep', 'shipped'] as const;

/** Projects on the ticket rail. The entry id (file name) is the slug traces refer to. */
export const projectSchema = z.strictObject({
  ticket: z.string().regex(/^\d{3}$/, 'must be a three-digit ticket number, e.g. "001"'),
  name: z.string().min(1),
  order: z.number().int().positive(),
  status: z.enum(projectStatuses),
});

export const traceRoles = ['task', 'sous-chef', 'station', 'pass'] as const;

const traceStep = z
  .strictObject({
    /** Seconds since the run started. */
    t: z.number().nonnegative(),
    role: z.enum(traceRoles),
    station: slug.optional(),
    /** Already sanitised and truncated to 280 characters by `pnpm trace:sanitize`. */
    text: z.string().min(1).max(280),
    model: z.string().min(1).optional(),
    tokens: z.number().int().nonnegative().optional(),
    latency_ms: z.number().nonnegative().optional(),
    cost_usd: z.number().nonnegative().optional(),
  })
  .refine((s) => (s.role === 'station') === (s.station !== undefined), {
    message: '`station` is required on station steps and only on station steps',
    path: ['station'],
  });

/** One recorded Brigade run (#10). */
export const traceSchema = z
  .strictObject({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'must be a file-name-safe run id'),
    project: slug,
    recorded_at: z.iso.datetime({ offset: true }),
    title: z.string().min(1),
    brigade_version: z.string().min(1),
    steps: z.array(traceStep).min(2),
    eval: z.strictObject({
      verdict: z.enum(['pass', 'fail']),
      score: z.number().optional(),
      note: z.string().min(1).optional(),
    }),
  })
  .superRefine((run, ctx) => {
    const last = run.steps.length - 1;
    run.steps.forEach((step, i) => {
      if (i === 0 && step.role !== 'task') {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'role'],
          message: 'the first step must be `task`',
        });
      }
      if (i !== 0 && step.role === 'task') {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'role'],
          message: '`task` may only be the first step',
        });
      }
      if (i === last && step.role !== 'pass') {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'role'],
          message: 'the last step must be `pass`',
        });
      }
      if (i !== last && step.role === 'pass') {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'role'],
          message: '`pass` may only be the last step',
        });
      }
      const prev = run.steps[i - 1];
      if (prev && step.t < prev.t) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 't'],
          message: '`t` must not go backwards',
        });
      }
    });
  });

/**
 * Collection id for a trace file at `<project>/<run-id>.json`, checking that
 * the path agrees with the file's own `project` and `id`. Throws (failing the
 * build) on a mismatch or a file outside a project folder.
 */
export function traceEntryId(entry: string, data: Record<string, unknown>): string {
  const match = /^([^/]+)\/([^/]+)\.json$/.exec(entry);
  if (!match) throw new Error(`trace ${entry}: expected traces/<project>/<run-id>.json`);
  const [, project, runId] = match;
  if (data['project'] !== project) {
    throw new Error(
      `trace ${entry}: "project" is ${JSON.stringify(data['project'])}, folder is "${project}"`,
    );
  }
  if (data['id'] !== runId) {
    throw new Error(
      `trace ${entry}: "id" is ${JSON.stringify(data['id'])}, file name is "${runId}"`,
    );
  }
  return `${project}/${runId}`;
}

/** The status strip. Every field is optional; a segment renders only when set. */
export const statusSchema = z.strictObject({
  cooking: z.string().min(1).optional(),
  lastShipped: z.string().min(1).optional(),
  reading: z.string().min(1).optional(),
});

export type Work = z.infer<typeof workSchema>;
export type Writing = z.infer<typeof writingSchema>;
export type Research = z.infer<typeof researchSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Trace = z.infer<typeof traceSchema>;
export type Status = z.infer<typeof statusSchema>;
