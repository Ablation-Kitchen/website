// Generates the Vale style for the site's vocabulary from GLOSSARY.md (#28).
// Every `_Avoid_:` word becomes a Vale alert that names the glossary term to use.
// Vale runs on src/content/** and only warns (`pnpm lint:prose`).
//
// Output: .vale/styles/Glossary/{Terms,Generic}.yml (generated, not committed).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

export type GlossaryEntry = { term: string; avoid: string[] };

/** Splits on commas that aren't inside parentheses or quotes. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Reads each `**Term**:` and its `_Avoid_:` line. Usage notes ("Using “order”
 * for sorting") aren't words to match, so they're dropped, and so are words the
 * glossary allows in body copy, or that are glossary terms themselves.
 */
export function parseGlossary(markdown: string): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  let term: string | undefined;
  for (const line of markdown.split('\n')) {
    const head = /^\*\*(.+?)\*\*:\s*$/.exec(line);
    if (head) {
      term = head[1]!;
      continue;
    }
    const avoid = /^_Avoid_:\s*(.+)$/.exec(line);
    if (!avoid || !term) continue;
    const words = splitTopLevel(avoid[1]!)
      .filter((item) => !/^using\b/i.test(item))
      .filter((item) => !/\(fine in body copy/i.test(item))
      .map((item) => item.replace(/\s*\(.*\)\s*$/, '').trim())
      .filter(Boolean);
    entries.push({ term, avoid: words });
    term = undefined;
  }
  const terms = new Set(entries.map((e) => e.term.toLowerCase()));
  return entries
    .map((e) => ({ ...e, avoid: e.avoid.filter((w) => !terms.has(w.toLowerCase())) }))
    .filter((e) => e.avoid.length > 0);
}

/**
 * Everyday words the glossary lists only to name a concept ("number" for a
 * course, "who" for a role). Out of context they're usually fine, so they're
 * suggestions (shown locally), not warnings (annotated in CI).
 */
export const GENERIC = new Set([
  'actor',
  'article',
  'entry',
  'event',
  'execution',
  'index',
  'job',
  'line',
  'log',
  'number',
  'principle',
  'prep',
  'prompt',
  'rank',
  'session',
  'setup',
  'value',
  'who',
  'worker',
]);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Avoided word (lower case) → the glossary term(s) to use instead. A word two
 * terms avoid ("ticket") names both, since Vale keys must be unique.
 */
export function swaps(entries: GlossaryEntry[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { term, avoid } of entries) {
    for (const word of avoid) {
      const key = word.toLowerCase();
      const terms = map.get(key) ?? [];
      if (!terms.includes(term)) terms.push(term);
      map.set(key, terms);
    }
  }
  return map;
}

/** A Vale `substitution` rule. Each word also matches its plural. */
export function valeRule(map: Map<string, string[]>, level: 'warning' | 'suggestion'): string {
  const lines = [...map].map(
    ([word, terms]) =>
      `  ${JSON.stringify(`${escapeRegex(word)}(?:e?s)?`)}: ${JSON.stringify(terms.join("' or '"))}`,
  );
  return [
    '# Generated from GLOSSARY.md by scripts/vale-rules.ts. Do not edit.',
    'extends: substitution',
    "message: \"Glossary: use '%s' instead of '%s' (see GLOSSARY.md).\"",
    `level: ${level}`,
    'ignorecase: true',
    'swap:',
    ...lines,
    '',
  ].join('\n');
}

if (import.meta.main) {
  const root = new URL('../', import.meta.url);
  const entries = parseGlossary(readFileSync(new URL('GLOSSARY.md', root), 'utf8'));
  const all = swaps(entries);
  const generic = new Map([...all].filter(([word]) => GENERIC.has(word)));
  const specific = new Map([...all].filter(([word]) => !GENERIC.has(word)));
  const dir = new URL('.vale/styles/Glossary/', root);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('Terms.yml', dir), valeRule(specific, 'warning'));
  writeFileSync(new URL('Generic.yml', dir), valeRule(generic, 'suggestion'));
  console.log(`Vale: ${specific.size} warnings and ${generic.size} suggestions from GLOSSARY.md.`);
}
