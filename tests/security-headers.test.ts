import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inlineScriptHashes, inlineStyleAttributes } from '../integrations/security-headers.ts';
import {
  buildCsp,
  headersRule,
  HEADERS_LINE_LIMIT,
  TRUSTED_TYPES_POLICY,
} from '../src/lib/security-headers.ts';

const sha = (s: string) => `sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}`;

describe('inlineScriptHashes', () => {
  it('hashes the exact text of inline scripts', () => {
    const body = "\n  console.log('hi');\n";
    expect(inlineScriptHashes(`<head><script>${body}</script></head>`)).toEqual([sha(body)]);
  });

  it('includes inline module scripts', () => {
    expect(inlineScriptHashes('<script type="module">a()</script>')).toEqual([sha('a()')]);
  });

  it('skips external scripts and JSON data blocks', () => {
    const html =
      '<script type="module" src="/_astro/x.js"></script>' +
      '<script type="application/ld+json">{"@type":"Person"}</script>' +
      '<script type="application/json">{}</script>';
    expect(inlineScriptHashes(html)).toEqual([]);
  });
});

describe('inlineStyleAttributes', () => {
  it('finds style attributes on any element, quoted or not', () => {
    const html =
      '<div style="width:2px">a</div><svg><path style=\'fill:red\'/></svg><p style=x>b</p>';
    expect(inlineStyleAttributes(html)).toHaveLength(3);
  });

  it('ignores style elements, data-style attributes and text inside scripts', () => {
    const html =
      '<style>.a{}</style><div data-style="x" class="style">style="no"</div><script>el.setAttribute("style", "a"); const s = \'<b style="x">\';</script>';
    expect(inlineStyleAttributes(html)).toEqual([]);
  });
});

describe('buildCsp', () => {
  it('quotes, dedupes and sorts the hashes into script-src', () => {
    const csp = buildCsp(['sha256-b', 'sha256-a', 'sha256-b']);
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval' 'sha256-a' 'sha256-b';");
  });

  it('enforces Trusted Types with the one named policy', () => {
    const csp = buildCsp([]);
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp.endsWith(`trusted-types ${TRUSTED_TYPES_POLICY}`)).toBe(true);
  });

  it('never allows unsafe-inline or unsafe-eval', () => {
    expect(buildCsp(['sha256-a'])).not.toMatch(/'unsafe-(inline|eval|hashes)'/);
  });
});

describe('headersRule', () => {
  it('rejects lines over the _headers limit', () => {
    const tooLong = 'x'.repeat(HEADERS_LINE_LIMIT);
    expect(() => headersRule('/*', { 'X-Long': tooLong })).toThrow(/limit/);
  });
});

describe('security.txt', () => {
  const txt = readFileSync(new URL('../public/.well-known/security.txt', import.meta.url), 'utf8');

  it('names the site contact', () => {
    expect(txt).toMatch(/^Contact: mailto:dalmo@ablation\.kitchen$/m);
  });

  // RFC 9116: Expires is required and should be under a year away. This fails a
  // month before it lapses, so it gets renewed in time.
  it('has an Expires between 30 days and a year away', () => {
    const iso = /^Expires: (.+)$/m.exec(txt)?.[1];
    expect(iso).toBeDefined();
    const days = (Date.parse(iso!) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(30);
    expect(days).toBeLessThanOrEqual(366);
  });
});
