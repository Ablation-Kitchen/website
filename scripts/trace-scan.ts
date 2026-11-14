// `pnpm trace:scan [dir…]`: the blocking CI secret scan for traces (#10, #37).
// Runs the same secret check as `pnpm trace:sanitize` over every string in
// every trace JSON file, and exits 1 on any match (or on a file that isn't
// valid JSON). Defaults to the committed traces and the rail test fixture.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findSecrets } from '../src/lib/trace-sanitize.ts';

const DEFAULT_DIRS = ['src/content/traces', 'test/fixtures/rail/traces'];
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_DIRS;

const files = dirs.flatMap((dir) => {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`trace:scan: ${dir} is not a directory`);
    process.exit(2);
  }
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(dir, f))
    .sort();
});

let failed = false;
for (const file of files) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`${file}: not valid JSON (${err instanceof Error ? err.message : err})`);
    failed = true;
    continue;
  }
  for (const f of findSecrets(data)) {
    console.error(`${file}: ${f.path}: looks like a ${f.kind} (${f.preview})`);
    failed = true;
  }
}

if (failed) {
  console.error(
    'trace:scan failed. Run `pnpm trace:sanitize` on the raw run and commit its output.',
  );
  process.exit(1);
}
console.log(`trace:scan: ${files.length} trace file(s) clean`);
