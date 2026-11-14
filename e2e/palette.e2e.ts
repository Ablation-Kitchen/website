// The ⌘K "Call an order" palette (#38), against the built site under the real
// dist/_headers. The done-when items: no Pagefind bytes before the first open,
// focus back on the trigger after Esc (axe with the dialog open is in
// a11y.e2e.ts, Pagefind under the CSP in csp.e2e.ts). Plus the shortcuts, the
// warming-up and no-match states, search results and the actions.
import { expect, test, type Page } from '@playwright/test';
import { noMatch, STATUS } from '../src/lib/palette.ts';

const PAGEFIND = /\/pagefind\//;
/** A word on /about (the PhD paragraph), so it's in the index. */
const INDEXED_WORD = 'Warwick';

const trigger = (page: Page) => page.getByRole('button', { name: 'Call an order' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Call an order' });
const combobox = (page: Page) => dialog(page).getByRole('combobox');
const status = (page: Page) => dialog(page).getByRole('status');

/** Waits until the element's script has run (the trigger is hidden until then). */
async function ready(page: Page, path = '/') {
  await page.goto(path);
  await expect(trigger(page)).toBeVisible();
}

test('no Pagefind bytes load before the first open; opening loads it', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (PAGEFIND.test(new URL(r.url()).pathname)) requests.push(r.url());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(trigger(page)).toBeVisible();
  // Moving around the page, focusing the trigger and hovering it load nothing either.
  await trigger(page).hover();
  await trigger(page).focus();
  await page.mouse.wheel(0, 2000);
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual([]);

  const loaded = page.waitForRequest((r) => new URL(r.url()).pathname === '/pagefind/pagefind.js');
  await trigger(page).click();
  await loaded;
});

test('Esc closes the dialog and returns focus to the trigger', async ({ page }) => {
  await ready(page);
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(combobox(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();

  // Opened from the keyboard, focus still lands on the trigger.
  await page.keyboard.press('Control+k');
  await expect(combobox(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger(page)).toBeFocused();
});

test('⌘K / Ctrl+K toggle the palette; / opens it unless typing', async ({ page }) => {
  await ready(page);
  for (const keys of ['Control+k', 'Meta+k']) {
    await page.keyboard.press(keys);
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press(keys);
    await expect(dialog(page)).toBeHidden();
  }

  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('/');
  await expect(dialog(page)).toBeVisible();
  // The slash opened the palette; it isn't typed into the field.
  await expect(combobox(page)).toHaveValue('');
  await page.keyboard.press('Escape');

  // In a text field, `/` is just a character.
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'test field');
    document.querySelector('main')!.prepend(input);
    input.focus();
  });
  await page.keyboard.press('/');
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByLabel('test field')).toHaveValue('/');
});

test('fires search-open with via = button | keys', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    Object.assign(window, {
      __calls: calls,
      umami: { track: (event: string, data: unknown) => calls.push([event, data]) },
    });
  });
  await ready(page);
  await trigger(page).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as unknown as { __calls: unknown[] }).__calls)).toEqual([
    ['search-open', { via: 'button' }],
    ['search-open', { via: 'keys' }],
  ]);
});

test('the empty palette lists Go to and Actions', async ({ page }) => {
  await ready(page);
  await trigger(page).click();
  const goTo = dialog(page).getByRole('group', { name: 'Go to' });
  for (const name of ['Work', 'Research', 'About']) {
    await expect(goTo.getByRole('option', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  const actions = dialog(page).getByRole('group', { name: 'Actions' });
  for (const name of ['Toggle theme', 'Copy email', 'Download CV']) {
    await expect(actions.getByRole('option', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await expect(dialog(page).getByRole('group', { name: 'Search' })).toHaveCount(0);
  // The first option is active.
  const first = dialog(page).getByRole('option').first();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(combobox(page)).toHaveAttribute(
    'aria-activedescendant',
    (await first.getAttribute('id'))!,
  );
});

test('shows "warming up…" while Pagefind loads, then results with <mark> excerpts', async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/pagefind/pagefind.js', async (route) => {
    await held;
    await route.continue();
  });
  await ready(page);
  await trigger(page).click();
  await combobox(page).fill(INDEXED_WORD);
  await expect(status(page)).toHaveText(STATUS.warmingUp);

  release();
  const search = dialog(page).getByRole('group', { name: 'Search' });
  const hit = search.getByRole('option').first();
  await expect(hit).toBeVisible();
  await expect(status(page)).toHaveText('');
  await expect(hit.locator('mark').first()).toHaveText(new RegExp(INDEXED_WORD, 'i'));
  expect(await search.getByRole('option').count()).toBeLessThanOrEqual(8);

  // Arrow down to the /about hit (titled by its H1) and pick it.
  const about = search.getByRole('option', { name: /^Dalmo Veras/ });
  const options = dialog(page).getByRole('option');
  const index = await options.evaluateAll((els) =>
    els.findIndex((el) => el.querySelector('.label')?.textContent === 'Dalmo Veras'),
  );
  expect(index).toBeGreaterThan(0);
  for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown');
  await expect(about).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/about$/);
});

test("no match: 86'd, and the listbox collapses", async ({ page }) => {
  await ready(page);
  await trigger(page).click();
  const query = 'zzqxvplonk';
  await combobox(page).fill(query);
  await expect(status(page)).toHaveText(noMatch(query));
  await expect(dialog(page).getByRole('listbox', { includeHidden: true })).toBeHidden();
  await expect(combobox(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(combobox(page)).not.toHaveAttribute('aria-activedescendant');
});

test('Go to: filtering and Enter navigate', async ({ page }) => {
  await ready(page);
  await trigger(page).click();
  await combobox(page).fill('resea');
  const first = dialog(page).getByRole('option').first();
  await expect(first).toHaveAccessibleName(/^Research/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/research$/);
});

test('Actions: toggle theme and copy email', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ready(page);
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');

  await trigger(page).click();
  await combobox(page).fill('theme');
  await dialog(page)
    .getByRole('option', { name: /^Toggle theme/ })
    .click();
  await expect(dialog(page)).toBeHidden();
  await expect(html).toHaveAttribute('data-theme', before === 'dark' ? 'light' : 'dark');

  await trigger(page).click();
  await combobox(page).fill('email');
  await dialog(page)
    .getByRole('option', { name: /^Copy email/ })
    .click();
  await expect(status(page)).toHaveText(/^Copied /);
});
