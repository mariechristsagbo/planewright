import { expect, test } from '@playwright/test';

import { canvas, canvasBox, expectHistoryDisabled, readout } from './support.ts';

// The Selection tool on the page (ENG-09). Nothing can be drawn until ENG-11, so the page has no
// element to select; these check what the tool and its shortcuts do on the empty canvas. Selecting
// drawn elements end to end is ENG-11's check.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the Selection button says that it selects, and that there is nothing to select yet', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: 'Selection' })).toHaveAccessibleDescription(
    'Shortcuts V or 1. Selects elements; nothing can be drawn yet, so there is nothing to select.',
  );
});

test('REQ-S06 a drag from the empty canvas draws a marquee and never pans, even after Space was released off the canvas', async ({
  page,
}) => {
  const box = await canvasBox(page);
  await canvas(page).focus();
  await page.keyboard.down('Space');
  await page.getByRole('heading', { level: 1, name: 'Planewright' }).click();
  await page.keyboard.up('Space');
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 250, { steps: 5 });
  await page.mouse.up();
  await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
  await expectHistoryDisabled(page);
});

test('REQ-S09 Mod+A on the canvas is Select all, so the page’s text is not selected', async ({
  page,
}) => {
  await canvas(page).focus();
  await page.keyboard.press('ControlOrMeta+A');
  const selected: unknown = await page.evaluate('String(getSelection())');
  expect(selected).toBe('');
  await expectHistoryDisabled(page);
});

test('REQ-S10 Escape on the canvas returns to the Selection tool', async ({ page }) => {
  await canvas(page).focus();
  await page.keyboard.press('h');
  const selection = page.getByRole('button', { name: 'Selection' });
  await expect(selection).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await expect(selection).toHaveAttribute('aria-pressed', 'true');
  await expectHistoryDisabled(page);
});
