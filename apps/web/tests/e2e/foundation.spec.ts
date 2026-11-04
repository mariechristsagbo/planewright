import { expect, test } from '@playwright/test';

test('serves the foundation status page from the production build', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Planewright — foundation only');
  await expect(page.getByRole('heading', { level: 1, name: 'Planewright' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    'Foundation only — this build is not a drawing editor.',
  );
  await expect(page.getByRole('region', { name: 'Not implemented yet' })).toBeVisible();
});
