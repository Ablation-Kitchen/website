// Blocking CSP check (#21, #25): every built page loads under the real headers
// with no CSP or Trusted Types violation, no console error and no blocked request.
// The last test proves the check bites: an inline script the build didn't hash
// is refused and reported.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { TRUSTED_TYPES_POLICY } from '../src/lib/security-headers.ts';

const DIST = new URL('../dist/', import.meta.url).pathname;

/** URL path for each built HTML file (`a/index.html` → `/a/`, `404.html` → a missing path). */
function builtPages(): string[] {
  const files = readdirSync(DIST, { recursive: true, encoding: 'utf8' }).filter((f) =>
    f.endsWith('.html'),
  );
  if (files.length === 0) throw new Error('dist/ has no HTML. Run `pnpm build` first.');
  return files
    .map((f) => relative(DIST, join(DIST, f)).split(sep).join('/'))
    .map((f) => {
      if (f === '404.html') return '/csp-check-missing-page';
      if (f === 'index.html') return '/';
      if (f.endsWith('/index.html')) return `/${f.slice(0, -'index.html'.length)}`;
      return `/${f.slice(0, -'.html'.length)}`;
    })
    .sort();
}

type Violation = { directive: string; blocked: string; sample: string };
type Watched = Window & { __cspViolations?: Violation[] };

/** Records everything the check fails on, from before the first byte of the page runs. */
async function watch(page: Page) {
  const problems: string[] = [];
  // Every error counts; a warning only when it's about the CSP or Trusted Types.
  // (Other warnings vary by browser build, e.g. "Unrecognized feature" for a
  // Permissions-Policy name this Chromium doesn't ship.)
  page.on('console', (m) => {
    const csp = /content security policy|trusted ?type/i.test(m.text());
    if (m.type() === 'error' || (m.type() === 'warning' && csp)) {
      problems.push(`console ${m.type()}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) =>
    problems.push(`request failed: ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`),
  );
  await page.addInitScript(() => {
    const w = window as Watched;
    w.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__cspViolations!.push({
        directive: e.effectiveDirective,
        blocked: e.blockedURI,
        sample: e.sample,
      });
    });
  });
  return {
    problems,
    violations: () => page.evaluate(() => (window as Watched).__cspViolations ?? []),
  };
}

for (const path of builtPages()) {
  test(`${path}: no CSP violations or console errors`, async ({ page }) => {
    const w = await watch(page);
    const res = await page.goto(path, { waitUntil: 'load' });
    expect(res, 'no response').not.toBeNull();
    const csp = res!.headers()['content-security-policy'] ?? '';
    expect(csp, 'CSP header missing').toContain("require-trusted-types-for 'script'");
    expect(res!.headers()['cross-origin-embedder-policy']).toBe('require-corp');
    await page.evaluate(() => document.fonts.ready);
    expect(await w.violations()).toEqual([]);
    expect(w.problems).toEqual([]);
  });
}

test('home: fonts load under COEP and the theme toggle works', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/');
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  });
  expect(fonts.length, 'no self-hosted font loaded').toBeGreaterThan(0);

  const html = page.locator('html');
  const button = page.locator('theme-toggle button');
  const before = await html.getAttribute('data-theme');
  await button.click();
  const after = before === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', after);
  await expect(button).toHaveAttribute('aria-label', `Switch to ${before} theme`);
  // Reload: the bootstrap inline script (hashed) restores the choice before paint.
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after);

  expect(await w.violations()).toEqual([]);
  expect(w.problems).toEqual([]);
});

test('Trusted Types: raw HTML sinks are blocked, only the named policy exists', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate((name) => {
    // TypeScript's DOM lib has no Trusted Types yet.
    type Rules = { createHTML?: (s: string) => string };
    const tt = (
      window as unknown as { trustedTypes: { createPolicy(n: string, r: Rules): unknown } }
    ).trustedTypes;
    const attempt = (fn: () => void) => {
      try {
        fn();
        return 'allowed';
      } catch (e) {
        return (e as Error).name;
      }
    };
    return {
      rawSink: attempt(() => {
        document.body.innerHTML = '<b>x</b>';
      }),
      otherPolicy: attempt(() => tt.createPolicy('not-allowed', {})),
      namedPolicy: attempt(() => tt.createPolicy(name, { createHTML: (s) => s })),
    };
  }, TRUSTED_TYPES_POLICY);
  expect(result).toEqual({
    rawSink: 'TypeError',
    otherPolicy: 'TypeError',
    namedPolicy: 'allowed',
  });
});

test('negative: an inline script without a build hash is refused and reported', async ({
  page,
}) => {
  // Serve the real page and headers, plus one script the build never saw
  // (what an edge feature like Email Obfuscation, or an XSS, would add).
  await page.route('/', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace(
      '</head>',
      '<script>window.__injected = true;</script></head>',
    );
    await route.fulfill({ response: res, body });
  });
  const w = await watch(page);
  await page.goto('/');

  expect(await page.evaluate(() => 'injected' in window || '__injected' in window)).toBe(false);
  const violations = await w.violations();
  expect(violations).toContainEqual(
    expect.objectContaining({ directive: 'script-src-elem', blocked: 'inline' }),
  );
  expect(w.problems.some((p) => p.includes('Content Security Policy'))).toBe(true);
});
