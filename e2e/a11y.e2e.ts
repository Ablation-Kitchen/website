// Blocking axe check (#28, decision #20): every page in e2e/pages.ts, in Light
// and Dark, each with and without reduced motion. Any WCAG 2.2 A/AA or axe
// best-practice violation fails it. The ⌘K dialog is audited open, with Go to
// and Actions, with search results and with the no-match line (#38). The trace
// panel's states are audited in trace-rail.e2e.ts against a fixture build (#37).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { auditedPages } from './pages.ts';
import { noMatch } from '../src/lib/palette.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'];

const VARIANTS = [
  { theme: 'light', reducedMotion: 'no-preference' },
  { theme: 'dark', reducedMotion: 'no-preference' },
  { theme: 'light', reducedMotion: 'reduce' },
  { theme: 'dark', reducedMotion: 'reduce' },
] as const;

for (const page of auditedPages()) {
  for (const { theme, reducedMotion } of VARIANTS) {
    const motion = reducedMotion === 'reduce' ? ', reduced motion' : '';
    test(`${page.path}: no axe violations (${theme}${motion})`, async ({ page: tab }) => {
      // The theme follows the OS when nothing is saved (ThemeHead.astro).
      await tab.emulateMedia({ colorScheme: theme, reducedMotion });
      const res = await tab.goto(page.path, { waitUntil: 'load' });

      // A redirect would audit some other URL than the one listed (and Lighthouse
      // CI would then match no assertions), so the listed path must answer directly.
      expect(res, 'no response').not.toBeNull();
      expect(res!.request().redirectedFrom()?.url(), `${page.path} redirects`).toBeUndefined();
      expect(res!.status()).toBe(page.status ?? 200);

      await expect(tab.locator('html')).toHaveAttribute('data-theme', theme);
      await tab.evaluate(() => document.fonts.ready);
      // Let entrance animations settle, so contrast is checked on the final colours.
      // Looping ones (the float) never finish, so they're left running.
      await tab.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
            .map((a) => a.finished.catch(() => undefined)),
        ),
      );

      const { violations } = await new AxeBuilder({ page: tab }).withTags(TAGS).analyze();
      const summary = violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        help: v.helpUrl,
        targets: v.nodes.map((n) => n.target.join(' ')),
      }));
      expect(summary).toEqual([]);
    });
  }
}

/** The ⌘K dialog's states: what the reader can see in it at once. */
const PALETTE_STATES = [
  { name: 'Go to and Actions', query: '' },
  { name: 'search results', query: 'Warwick' },
  { name: 'no match', query: 'zzqxvplonk' },
] as const;

for (const { theme, reducedMotion } of VARIANTS) {
  for (const state of PALETTE_STATES) {
    const motion = reducedMotion === 'reduce' ? ', reduced motion' : '';
    test(`⌘K dialog open, ${state.name}: no axe violations (${theme}${motion})`, async ({
      page: tab,
    }) => {
      await tab.emulateMedia({ colorScheme: theme, reducedMotion });
      await tab.goto('/');
      await expect(tab.locator('html')).toHaveAttribute('data-theme', theme);
      await tab.getByRole('button', { name: 'Call an order' }).click();
      const dialog = tab.getByRole('dialog', { name: 'Call an order' });
      await expect(dialog).toBeVisible();
      if (state.query) await dialog.getByRole('combobox').fill(state.query);
      if (state.name === 'search results') {
        await expect(
          dialog.getByRole('group', { name: 'Search' }).getByRole('option').first(),
        ).toBeVisible();
      } else if (state.name === 'no match') {
        await expect(dialog.getByRole('status')).toHaveText(noMatch(state.query));
      }
      await tab.evaluate(() => document.fonts.ready);
      const { violations } = await new AxeBuilder({ page: tab }).withTags(TAGS).analyze();
      const summary = violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        help: v.helpUrl,
        targets: v.nodes.map((n) => n.target.join(' ')),
      }));
      expect(summary).toEqual([]);
    });
  }
}

test('negative: a violation the page does not have is reported', async ({ page: tab }) => {
  // Serve the real home page plus one button with no accessible name.
  await tab.route('/', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('</main>', '<button></button></main>');
    await route.fulfill({ response: res, body });
  });
  await tab.goto('/');
  const { violations } = await new AxeBuilder({ page: tab }).withTags(TAGS).analyze();
  expect(violations.map((v) => v.id)).toContain('button-name');
});
