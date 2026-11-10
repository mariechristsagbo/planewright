import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { canvas, canvasBox, expectHistoryDisabled, readout } from './support.ts';

// The Selection tool on the page (ENG-09). Nothing can be drawn until ENG-11, so the page has no
// element to select; these check what the tool and its shortcuts do on the empty canvas. Selecting
// drawn elements end to end is ENG-11's check.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

/** Counts the overlay canvas's device pixels that are not transparent, in the page. */
const INK = `(() => {
  const layer = document.querySelectorAll('[aria-label="Drawing canvas"] canvas')[1];
  const { data } = layer.getContext('2d').getImageData(0, 0, layer.width, layer.height);
  let ink = 0;
  for (let alpha = 3; alpha < data.length; alpha += 4) if (data[alpha] !== 0) ink += 1;
  return ink;
})()`;

const overlayInk = async (page: Page): Promise<number> => Number(await page.evaluate(INK));

test('the Selection button says that it selects and transforms the drawn elements', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: 'Selection' })).toHaveAccessibleDescription(
    'Shortcuts V or 1. Selects, moves, resizes and rotates the drawn elements.',
  );
});

test('REQ-S06 a drag from the empty canvas draws a marquee and never pans, even after Space was released off the canvas', async ({
  page,
}) => {
  const box = await canvasBox(page);
  await canvas(page).focus();
  await page.keyboard.down('Space');
  // A press on the view readout, which nothing else answers, takes the focus off the canvas.
  await readout(page).click();
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

test('a tool change during a marquee removes it, and the release and Escape leave nothing drawn', async ({
  page,
}) => {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300, { steps: 5 });
  await expect.poll(() => overlayInk(page)).toBeGreaterThan(0);
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'Hand', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => overlayInk(page)).toBe(0);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Selection' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => overlayInk(page)).toBe(0);
  await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
});
