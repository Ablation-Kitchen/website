import type { Element } from 'hast';
import { describe, expect, it } from 'vitest';
import {
  CODE_COLOURS,
  classifyTokens,
  codeTheme,
  roleForStyle,
  TOKEN_ROLES,
} from '../src/lib/markdown/code-theme';

const span = (style: string, className?: string[]): Element => ({
  type: 'element',
  tagName: 'span',
  properties: { style, ...(className ? { className } : {}) },
  children: [{ type: 'text', value: 'x' }],
});

describe('roleForStyle', () => {
  it('maps each sentinel colour to its role, case-insensitively', () => {
    TOKEN_ROLES.forEach((role, i) => {
      const sentinel = codeTheme.tokenColors[i]!.settings.foreground;
      expect(roleForStyle(`--0:${sentinel}`)).toBe(role);
      expect(roleForStyle(`--0:${sentinel.toUpperCase()};`)).toBe(role);
    });
  });

  it("treats the theme's own text colour as plain", () => {
    expect(roleForStyle('--0:#111111')).toBe('plain');
  });

  it('leaves anything else alone (so the build guard catches it)', () => {
    expect(roleForStyle('--0:#616972;--1:#99A0A6')).toBeUndefined();
    expect(roleForStyle('--0:#000001;font-style:italic')).toBeUndefined();
    expect(roleForStyle('color:red')).toBeUndefined();
  });
});

describe('classifyTokens', () => {
  it('swaps sentinel styles for classes, drops plain ones, keeps unknown ones', () => {
    const line: Element = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['ec-line'] },
      children: [span('--0:#000002', ['a']), span('--0:#111111'), span('color:red')],
    };
    classifyTokens(line);
    const [kw, plain, other] = line.children as Element[];
    expect(kw!.properties).toEqual({ className: ['a', 'tok-keyword'] });
    expect(plain!.properties).toEqual({});
    expect(other!.properties).toEqual({ style: 'color:red' });
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// Code sits on --color-surface: #ffffff (Light), #141413 (Dark).
describe.each([
  ['light', '#ffffff'],
  ['dark', '#141413'],
] as const)('%s syntax colours', (scheme, surface) => {
  for (const role of TOKEN_ROLES)
    it(`${role} is at least 4.5:1 on the surface`, () => {
      expect(contrast(CODE_COLOURS[role][scheme], surface)).toBeGreaterThanOrEqual(4.5);
    });
});
