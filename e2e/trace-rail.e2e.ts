// The ticket rail and trace replay (#37) in a real browser, under the real CSP.
// What's cooking only renders once a real trace exists (#6), so these run
// against a fixture build: `TRACE_FIXTURE=1 pnpm build && pnpm test:rail`
// (CI: the "Trace fixture" job). Against a normal build they check instead
// that the section is absent.
//
// Covers: every step listed without JS; the replay on entering the viewport,
// once, plus Replay; all at once under reduced motion; selecting a card
// (aria-pressed, by mouse and keyboard); and axe on each panel state in Light
// and Dark, with and without reduced motion.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_MARKER } from '../src/lib/trace-fixture.ts';

const home = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const fixtureBuild = home.includes(FIXTURE_MARKER);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'];

const rail = (page: Page) => page.locator('ticket-rail');
const panel = (page: Page) => page.locator('#trace-replay');
const steps = (page: Page) => panel(page).locator('[data-step]');
const card = (page: Page, name: string) =>
  rail(page).getByRole('button', { name: new RegExp(name) });
const replayButton = (page: Page) => panel(page).getByRole('button', { name: 'Replay' });

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(' ')),
  }));
}

test.describe('normal build', () => {
  test.skip(fixtureBuild, 'fixture build: the rail is shown');

  test('What’s cooking is absent without a real trace', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#whats-cooking-h')).toHaveCount(0);
    await expect(rail(page)).toHaveCount(0);
  });
});

test.describe('fixture build', () => {
  test.skip(!fixtureBuild, 'needs `TRACE_FIXTURE=1 pnpm build`');

  test.describe('without JS', () => {
    test.use({ javaScriptEnabled: false });

    test('lists every step of the latest run, with no Replay button', async ({ page }) => {
      await page.goto('/');
      await expect(panel(page)).toHaveAttribute('data-run', 'trace-fixture-002');
      await expect(steps(page)).toHaveCount(6);
      for (const step of await steps(page).all()) await expect(step).toBeVisible();
      await expect(replayButton(page)).toBeHidden();
      await expect(panel(page).locator('[data-slot="summary"]')).toHaveText(
        '01:12 · 4,420 tokens · $0.0245 · Pass',
      );
    });
  });

  test('replays once on entering the viewport, then on Replay', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    // Below the fold: armed, steps hidden but keeping their space.
    await expect(panel(page)).toHaveAttribute('data-state', 'armed');
    await expect(steps(page).first()).toBeHidden();
    const box = await panel(page).boundingBox();

    await panel(page).scrollIntoViewIfNeeded();
    await expect(panel(page)).toHaveAttribute('data-state', 'playing');
    await expect(steps(page).first()).toBeVisible();
    await expect(steps(page).last()).toBeHidden();
    await expect(panel(page)).toHaveAttribute('data-state', 'done', { timeout: 10_000 });
    await expect(steps(page).last()).toBeVisible();
    expect((await panel(page).boundingBox())?.height).toBe(box?.height);

    // Plays once: scrolling away and back does not restart it.
    await page.evaluate(() => window.scrollTo(0, 0));
    await panel(page).scrollIntoViewIfNeeded();
    await expect(panel(page)).toHaveAttribute('data-state', 'done');

    await replayButton(page).click();
    await expect(panel(page)).toHaveAttribute('data-state', 'playing');
    await expect(steps(page).last()).toBeHidden();
    await expect(panel(page)).toHaveAttribute('data-state', 'done', { timeout: 10_000 });
  });

  test('shows every step at once under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(rail(page)).toBeAttached();
    await page.waitForFunction(() => customElements.get('ticket-rail') !== undefined);
    await expect(panel(page)).toHaveAttribute('data-state', 'static');
    for (const step of await steps(page).all()) await expect(step).toBeVisible();
    await expect(replayButton(page)).toBeHidden();
  });

  test('pressing a card loads that project’s latest run', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const brigade = card(page, 'The Brigade');
    const spoon = card(page, 'The Tasting Spoon');
    await expect(brigade).toHaveAttribute('aria-pressed', 'true');
    await expect(spoon).toHaveAttribute('aria-pressed', 'false');

    await spoon.click();
    await expect(spoon).toHaveAttribute('aria-pressed', 'true');
    await expect(brigade).toHaveAttribute('aria-pressed', 'false');
    await expect(panel(page)).toHaveAttribute('data-run', 'trace-fixture-003');
    await expect(panel(page).locator('[data-slot="title"]')).toHaveText(
      'Fixture run: grade a retrieval answer against its sources',
    );
    await expect(steps(page)).toHaveCount(3);
    await expect(steps(page).nth(1)).toContainText('Critique · sonnet-5.5');
    await expect(steps(page).first().locator('[data-slot="model"]')).toHaveCount(0);
    await expect(steps(page).last().locator('[data-slot="verdict"]')).toHaveText('Fail');
    await expect(panel(page).locator('[data-slot="summary"]')).toHaveText('00:06 · $0.0091 · Fail');

    // Keyboard: back to The Brigade with Space.
    await brigade.focus();
    await page.keyboard.press('Space');
    await expect(brigade).toHaveAttribute('aria-pressed', 'true');
    await expect(steps(page)).toHaveCount(6);
    await expect(steps(page).last().locator('[data-slot="verdict"]')).toHaveText('Pass');
  });

  test('pressing a card with motion allowed replays the new run', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await card(page, 'The Tasting Spoon').click();
    await expect(panel(page)).toHaveAttribute('data-run', 'trace-fixture-003');
    await expect(panel(page)).toHaveAttribute('data-state', 'playing');
    await expect(panel(page)).toHaveAttribute('data-state', 'done', { timeout: 10_000 });
    for (const step of await steps(page).all()) await expect(step).toBeVisible();
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const variant = `${theme}${reducedMotion === 'reduce' ? ', reduced motion' : ''}`;

      test(`axe: both panel states pass (${variant})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await page.evaluate(() => document.fonts.ready);

        // The first project's run, fully shown (after its replay, with motion).
        await panel(page).scrollIntoViewIfNeeded();
        const settled = reducedMotion === 'reduce' ? 'static' : 'done';
        await expect(panel(page)).toHaveAttribute('data-state', settled, { timeout: 10_000 });
        expect(await axe(page)).toEqual([]);

        // The second project's failed run.
        await card(page, 'The Tasting Spoon').click();
        await expect(panel(page)).toHaveAttribute('data-run', 'trace-fixture-003');
        await expect(panel(page)).toHaveAttribute('data-state', settled, { timeout: 10_000 });
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
              .map((a) => a.finished.catch(() => undefined)),
          ),
        );
        expect(await axe(page)).toEqual([]);
      });
    }
  }
});
