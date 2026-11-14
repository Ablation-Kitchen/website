// Lighthouse CI (#28, decision #20): every audited page, mobile, 3 runs, served by
// `wrangler dev` so dist/_headers (CSP and the rest) applies as in production.
// The page list lives in e2e/pages.ts, shared with the axe suite.
// Run `pnpm build` first, then `pnpm test:lhci`.
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { auditedPages } from './e2e/pages.ts';

const PORT = 8789;
const ORIGIN = `http://127.0.0.1:${PORT}`;

/** Thresholds from #28. If the spec's quality bar is ever stricter, the spec wins. */
const BUDGET = {
  'categories:accessibility': ['error', { minScore: 1 }],
  'categories:best-practices': ['error', { minScore: 1 }],
  'categories:seo': ['error', { minScore: 1 }],
  'categories:performance': ['error', { minScore: 0.95 }],
  // Transfer size, so compressed (wrangler dev gzips like the edge does).
  'resource-summary:script:size': ['error', { maxNumericValue: 100 * 1024 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
  'total-blocking-time': ['error', { maxNumericValue: 150 }],
};

// The scored audits of a category, from the Lighthouse version LHCI runs.
const lighthouse = createRequire(createRequire(import.meta.url).resolve('@lhci/cli/package.json'));
const { categories } = lighthouse('lighthouse/core/config/default-config.js').default;
const scoredAudits = (category) =>
  categories[category].auditRefs.filter((a) => a.weight > 0).map((a) => a.id);

/**
 * An error page fails three audits by design: `http-status-code` (any 4xx),
 * `is-crawlable` (it's noindex) and `errors-in-console` (Chrome logs the
 * document's own 404). So its SEO and Best Practices categories are replaced by
 * every other audit in them at 100, and the console may hold that one error.
 */
const ERROR_PAGE_BUDGET = {
  ...BUDGET,
  'categories:seo': 'off',
  'categories:best-practices': 'off',
  ...Object.fromEntries(
    [...scoredAudits('seo'), ...scoredAudits('best-practices')]
      .filter((id) => !['http-status-code', 'is-crawlable', 'errors-in-console'].includes(id))
      .map((id) => [id, ['error', { minScore: 1 }]]),
  ),
  'errors-in-console': ['error', { maxLength: 1 }],
};

const pages = auditedPages();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default {
  ci: {
    collect: {
      url: pages.map((p) => ORIGIN + p.path),
      numberOfRuns: 3,
      startServerCommand: `pnpm exec wrangler dev --ip 127.0.0.1 --port ${PORT}`,
      startServerReadyPattern: 'Ready on',
      startServerReadyTimeout: 60_000,
      chromePath: chromium.executablePath(),
      settings: {
        // Lighthouse's default form factor is mobile (Moto G Power, simulated slow 4G).
        chromeFlags: '--headless=new --no-sandbox',
        // Audit the 404 page instead of aborting on its status. A page that 404s
        // by mistake still fails: its SEO category (http-status-code) must be 100.
        ignoreStatusCode: true,
      },
    },
    assert: {
      // Assertions match on the URL a run ended at. scripts/lhci-check-urls.ts
      // fails the gate if a listed path redirected, so none can slip through.
      assertMatrix: pages.map((p) => ({
        matchingUrlPattern: `^${escape(ORIGIN + p.path)}$`,
        // Median of the 3 runs, so one lucky run can't pass a slow page.
        aggregationMethod: 'median',
        assertions: (p.status ?? 200) === 200 ? BUDGET : ERROR_PAGE_BUDGET,
      })),
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
