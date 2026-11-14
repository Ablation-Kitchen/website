// /about and the CV (#35), against the built site under the real dist/_headers.
import { expect, test } from '@playwright/test';
import { cv, person } from '../src/site.config.ts';

test('/cv.pdf is served inline as a PDF under the CV file name', async ({ request }) => {
  const res = await request.get(cv.href);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect(res.headers()['content-disposition']).toBe(`inline; filename="${cv.downloadName}"`);
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('/about: CV and email CTAs, the privacy note and the analytics hooks', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(person.name);

  const download = page.getByRole('link', { name: /Download CV/ });
  await expect(download).toHaveAttribute('href', cv.href);
  await expect(download).toHaveAttribute('download', cv.downloadName);
  await expect(download).toHaveAttribute('data-umami-event', 'cv-download');

  const email = page.getByRole('link', { name: 'Email me' });
  await expect(email).toHaveAttribute('href', `mailto:${person.email}`);
  await expect(email).toHaveAttribute('data-umami-event', 'email-click');
  await expect(email).toHaveAttribute('data-umami-event-location', 'about');

  const main = page.locator('main');
  for (const profile of ['linkedin', 'github']) {
    await expect(
      main.locator(`a[data-umami-event="profile-click"][data-umami-event-profile="${profile}"]`),
    ).toHaveCount(1);
  }

  await expect(page.locator('#privacy')).toContainText('6 months');
  await expect(page.getByRole('heading', { name: 'Kitchen rules' })).toBeVisible();
  await expect(page.locator('main ol > li')).toHaveCount(5);
});

test('/about: the footer privacy link lands on the note', async ({ page }) => {
  await page.goto('/about');
  await page.locator('footer').getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL(/\/about\/?#privacy$/);
  await expect(page.locator('#privacy')).toBeInViewport();
});

test('the CV download saves under the CV file name', async ({ page }) => {
  await page.goto('/about');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Download CV/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(cv.downloadName);
});
