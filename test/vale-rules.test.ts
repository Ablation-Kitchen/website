import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENERIC, parseGlossary, swaps, valeRule } from '../scripts/vale-rules.ts';

const GLOSSARY = readFileSync(new URL('../GLOSSARY.md', import.meta.url), 'utf8');

describe('parseGlossary', () => {
  it('reads each term with its avoided words, without the parenthetical notes', () => {
    const md = [
      '**Case study**:',
      'A long-form account.',
      '_Avoid_: Dish, project, work item (“dish” is display copy only, e.g. “See the dishes →”)',
      '',
      '**Project**:',
      'Current work.',
      '_Avoid_: Ticket (“Ticket 001” is display copy only), current project item',
    ].join('\n');
    expect(parseGlossary(md)).toEqual([
      // "project" is itself a glossary term, so it isn't flagged.
      { term: 'Case study', avoid: ['Dish', 'work item'] },
      { term: 'Project', avoid: ['Ticket', 'current project item'] },
    ]);
  });

  it('drops usage notes and words allowed in body copy', () => {
    const md = [
      '**Order**:',
      'The first section.',
      '_Avoid_: Using “order” for sorting or summaries',
      '',
      '**Sous chef**:',
      'The orchestrator.',
      '_Avoid_: Orchestrator (fine in body copy, but not as a role name in traces), manager agent',
    ].join('\n');
    expect(parseGlossary(md)).toEqual([{ term: 'Sous chef', avoid: ['manager agent'] }]);
  });

  it('finds every term in GLOSSARY.md that has an avoid list', () => {
    const terms = parseGlossary(GLOSSARY).map((e) => e.term);
    expect(terms).toContain('Tasting menu');
    expect(terms).toContain('Trace');
    expect(terms).not.toContain('Order');
    // Every generic word still comes from the glossary, so the list can't go stale silently.
    const words = new Set(swaps(parseGlossary(GLOSSARY)).keys());
    expect([...GENERIC].filter((w) => !words.has(w))).toEqual([]);
  });
});

describe('valeRule', () => {
  it('has one key per word, naming every term that avoids it', () => {
    // Duplicate YAML keys make Vale drop the whole rule without an error.
    const map = swaps([
      { term: 'Project', avoid: ['Ticket'] },
      { term: 'Task', avoid: ['ticket', 'job'] },
    ]);
    const rule = valeRule(map, 'warning');
    expect(rule.match(/ticket/gi)).toHaveLength(1);
    expect(rule).toContain(`"ticket(?:e?s)?": "Project' or 'Task"`);
    expect(rule).toContain('level: warning');
  });

  it('escapes regex characters in words', () => {
    const rule = valeRule(swaps([{ term: 'X', avoid: ['a.b'] }]), 'suggestion');
    expect(rule).toContain(String.raw`"a\\.b(?:e?s)?"`);
  });
});
