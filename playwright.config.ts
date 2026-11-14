// Browser checks against the built site, served by `wrangler dev` so
// dist/_headers (the CSP and the rest) applies exactly as in production.
// Run `pnpm build` first. Files are `*.e2e.ts` so Vitest doesn't collect them:
// `pnpm test:csp` and `pnpm test:a11y` each run one file, `pnpm test:e2e` all of them.
import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec wrangler dev --ip 127.0.0.1 --port ${PORT} --log-level warn`,
    url: `http://127.0.0.1:${PORT}/`,
    env: { WRANGLER_SEND_METRICS: 'false' },
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
