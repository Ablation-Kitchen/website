// /research (#34), against the built site. Done-when: new `research/` entries
// appear without code changes. So the bench must list exactly the non-draft
// files in src/content/research/, read from disk here rather than hard-coded.
import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const CONTENT = new URL('../src/content/research/', import.meta.url);

/** Ids (file names) of the research entries whose front matter isn't `draft: true`. */
function publishedEntryIds(): string[] {
  return readdirSync(CONTENT)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => {
      const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(new URL(f, CONTENT), 'utf8'));
      return !/^draft:\s*true\s*$/m.test(front?.[1] ?? '');
    })
    .map((f) => f.slice(0, -'.md'.length))
    .sort();
}

test('/research: framing, glance panel and every published entry on the bench', async ({
  page,
}) => {
  await page.goto('/research');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Take one ingredient out. Taste the difference.',
  );
  await expect(page.getByRole('heading', { name: 'How an ablation reads' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'On the bench' })).toBeVisible();

  const ids = await page
    .locator('[data-bench-entry]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-bench-entry')));
  const expected = publishedEntryIds();
  expect(expected.length).toBeGreaterThan(0);
  expect([...ids].sort()).toEqual(expected);
});

test('/research: the PhD entry carries its Lab tag', async ({ page }) => {
  await page.goto('/research');
  const phd = page.locator('#warwick-phd');
  await expect(phd.getByRole('heading', { level: 3 })).toContainText('Topology-aware');
  await expect(phd).toContainText('PhD candidate · Warwick · topology-aware ML');
});
