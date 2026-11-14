// `pnpm trace:sanitize <raw-run.json> [--write]` (decision #10, #37). Run it on
// a Brigade run export before committing it as a trace.
//
// Keeps the schema's fields only, masks secret-like strings and truncates each
// step's text to 280 characters (src/lib/trace-sanitize.ts), then validates the
// result. Prints the trace to stdout, or with --write saves it to
// src/content/traces/<project>/<id>.json. What it dropped, masked or cut goes
// to stderr. Exits 1 if the result is still invalid or still holds a secret.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { findSecrets, sanitizeRun } from '../src/lib/trace-sanitize.ts';

const args = process.argv.slice(2);
const write = args.includes('--write');
const input = args.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('usage: pnpm trace:sanitize <raw-run.json> [--write]');
  process.exit(2);
}

try {
  const { run, dropped, masked, truncated } = sanitizeRun(JSON.parse(readFileSync(input, 'utf8')));
  if (dropped.length) console.error(`dropped ${dropped.length} field(s): ${dropped.join(', ')}`);
  if (masked) console.error(`masked ${masked} secret-like string(s)`);
  if (truncated.length) console.error(`truncated the text of step(s) ${truncated.join(', ')}`);
  const leftover = findSecrets(run);
  if (leftover.length) {
    for (const f of leftover) console.error(`still secret-like: ${f.path} (${f.kind})`);
    process.exit(1);
  }
  const json = `${JSON.stringify(run, null, 2)}\n`;
  if (write) {
    const out = `src/content/traces/${run.project}/${run.id}.json`;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, json);
    console.error(`wrote ${out}`);
  } else {
    process.stdout.write(json);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
