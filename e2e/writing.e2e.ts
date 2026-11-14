// The recipe book (#44), against the built site: /writing, the post page, the
// homepage section, the nav link and the feeds, all present because a
// non-draft post exists (#6).
import { expect, test } from '@playwright/test';

const POST = '/writing/catching-nation-state-hackers-in-power-plants';
const TITLE =
  'Catching Nation-State Hackers in Power Plants: What the Research Gets Right (and Wrong)';

test('the header links to /writing, and the homepage shows the recipe book', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Writing' })).toHaveAttribute('href', '/writing');
  const book = page.locator('#recipe-book');
  await expect(book.getByRole('heading', { name: 'From the recipe book' })).toBeVisible();
  await expect(book.locator(`a[href="${POST}"]`)).toContainText(TITLE);
});

test('/writing lists the post and marks Writing as the current page', async ({ page }) => {
  await page.goto('/writing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From the recipe book');
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Writing' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: TITLE }).click();
  await expect(page).toHaveURL(new RegExp(`${POST}$`));
});

test('the post page has exactly one H1, the frontmatter title', async ({ page }) => {
  await page.goto(POST);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(TITLE);
  await expect(page.locator('main')).toContainText('min read');
  await expect(page.locator('main blockquote')).toContainText('TL;DR');
  await expect(page.getByRole('link', { name: 'All recipes' })).toHaveAttribute('href', '/writing');
  await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(1);
});

test('/rss.xml and /menu.txt list the post', async ({ request }) => {
  const rss = await request.get('/rss.xml');
  expect(rss.status()).toBe(200);
  expect(await rss.text()).toContain(`<link>https://ablation.kitchen${POST}</link>`);
  const menu = await request.get('/menu.txt');
  expect(await menu.text()).toContain(`](https://ablation.kitchen${POST}):`);
});
