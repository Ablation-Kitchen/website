// WCAG AA check on the colour tokens, read straight from src/styles/global.css
// so the test can't drift from the stylesheet.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

function tokens(selector: RegExp): Record<string, string> {
  const block = css.match(selector)?.[1];
  if (!block) throw new Error(`block not found: ${selector}`);
  return Object.fromEntries(
    [...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, hex]) => [
      name!,
      hex!,
    ]),
  );
}

const light = tokens(/@theme(?:\s+static)?\s*\{([^}]*)\}/);
const dark = tokens(/\[data-theme='dark'\]\s*\{([^}]*)\}/);
const darkFallback = tokens(/:root:not\(\[data-theme\]\)\s*\{([^}]*)\}/);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT = ['ink', 'soft', 'meta', 'accent-text'];
const BACKGROUNDS = ['bg', 'surface'];

describe.each([
  ['Light', light],
  ['Dark', dark],
])('%s theme', (_, theme) => {
  for (const text of TEXT)
    for (const bg of BACKGROUNDS)
      it(`${text} on ${bg} is at least 4.5:1`, () => {
        expect(contrast(theme[text]!, theme[bg]!)).toBeGreaterThanOrEqual(4.5);
      });
});

describe('trace panel', () => {
  for (const text of ['trace-text', 'trace-role', 'trace-meta'])
    it(`${text} on trace-bg is at least 4.5:1`, () => {
      expect(contrast(light[text]!, light['trace-bg']!)).toBeGreaterThanOrEqual(4.5);
    });
});

it('the no-JS Dark fallback matches the [data-theme=dark] tokens', () => {
  expect(darkFallback).toEqual(dark);
});

it('contrast() matches known values', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  expect(contrast('#4a6562', '#f7f6f3')).toBeCloseTo(5.84, 2);
});
