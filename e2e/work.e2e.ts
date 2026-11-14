// /work (#32), against the built site. Done-when: only non-draft courses show,
// numbered with no gaps. So the menu must list exactly the non-draft files in
// src/content/work/, in `order`, numbered i., ii., iii., … read from disk here
// rather than hard-coded. Runs on the deployed build (no PREVIEW_DRAFTS).
import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const CONTENT = new URL('../src/content/work/', import.meta.url);

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];

/** Every case study's id, `order` and draft flag, from its front matter. */
function courses() {
  return readdirSync(CONTENT)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(new URL(f, CONTENT), 'utf8'))?.[1];
      return {
        id: f.slice(0, -'.mdx'.length),
        order: Number(/^order:\s*(\d+)\s*$/m.exec(front ?? '')?.[1]),
        draft: /^draft:\s*true\s*$/m.test(front ?? ''),
        org: /^org:\s*(.+?)\s*$/m.exec(front ?? '')?.[1] ?? '',
      };
    });
}

test('/work: hero, then only the non-draft courses, numbered with no gaps', async ({ page }) => {
  await page.goto('/work');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The tasting menu');
  await expect(page.locator('h1 em')).toHaveText('The tasting menu');
  await expect(page.locator('main')).toContainText('Signature dishes · case studies');
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Work' }),
  ).toHaveAttribute('aria-current', 'page');

  const all = courses();
  expect(all.length).toBeGreaterThan(0);
  const published = all.filter((c) => !c.draft).sort((a, b) => a.order - b.order);

  const rows = await page.locator('[data-course]').evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute('data-course'),
      numeral: el.querySelector('[data-numeral]')?.textContent?.replace('Course', '').trim(),
      href: el.querySelector('a')?.getAttribute('href'),
    })),
  );
  expect(rows).toEqual(
    published.map((c, i) => ({ id: c.id, numeral: `${ROMAN[i]}.`, href: `/work/${c.id}` })),
  );

  // No draft leaks anywhere on the page, the ticket included.
  for (const c of all.filter((c) => c.draft)) {
    await expect(page.locator(`a[href="/work/${c.id}"]`)).toHaveCount(0);
  }

  if (published.length === 0) {
    await expect(page.locator('main')).toContainText('No case study is on the menu yet.');
    await expect(page.locator('main a[href="/about"]')).toBeVisible();
  }
});
