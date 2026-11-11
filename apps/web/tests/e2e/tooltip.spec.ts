import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { canvas, canvasBox } from './support.ts';

// The chrome's tooltips (ADR 0012 and the v0.2 plan's S3): a control's tip opens at once on
// keyboard focus and after 500 ms of hover, never on touch, and closes on Escape or when the
// pointer leaves; it repeats the control's name and keys, which the control keeps.

const tip = (page: Page): Locator => page.getByRole('tooltip');

/** Longer than the live region's pause before a message, so that a change would have shown. */
const SETTLE_MS = 300;

/** The centre of a control, where the mouse rests on it. */
async function centreOf(control: Locator): Promise<[number, number]> {
  const box = await control.boundingBox();
  if (box === null) throw new Error('The control is not laid out.');
  return [box.x + box.width / 2, box.y + box.height / 2];
}

test('D4 D6 A6 a tooltip appears at once on keyboard focus and closes on Escape, the focus staying', async ({
  page,
}) => {
  await openPage(page);
  const hand = toolButton(page, 'Hand');
  await page.keyboard.press('Tab');
  await expect(tip(page)).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(hand).toBeFocused();
  await expect(tip(page)).toBeVisible({ timeout: 250 });
  await expect(tip(page)).toHaveText(/^Hand\s*H$/u);
  // A description: the control keeps its name, keys and description while its tip shows.
  await expect(hand).toHaveAccessibleName('Hand');
  await expect(hand).toHaveAttribute('aria-keyshortcuts', 'H');
  await expect(hand).toHaveAccessibleDescription('Shortcut H. Drag to pan the canvas.');
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  await expect(hand).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tip(page)).toHaveText(/^Selection\s*V\s*or\s*1$/u, { timeout: 250 });
  await page.keyboard.press('Tab');
  await expect(tip(page)).toHaveCount(0);
});

test('D4 A6 the Escape that closes a tip goes no further: the chosen tool and the selection stay until a second Escape', async ({
  page,
}) => {
  await openPage(page);
  const rectangle = toolButton(page, 'Rectangle');
  for (const key of ['Tab', 'Tab', 'ArrowRight', 'ArrowRight', 'Enter']) {
    await page.keyboard.press(key);
  }
  await expect(rectangle).toHaveAttribute('aria-pressed', 'true');
  await expect(tip(page)).toHaveText(/^Rectangle\s*R\s*or\s*2$/u);
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  await page.waitForTimeout(SETTLE_MS);
  await expect(rectangle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(rectangle).toHaveAttribute('aria-pressed', 'false');
  await expect(toolButton(page, 'Selection')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Tab');
  await expect(canvas(page)).toBeFocused();
  for (const key of ['r', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await page.keyboard.press('Shift+Tab');
  await expect(rectangle).toBeFocused();
  await expect(tip(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  await page.waitForTimeout(SETTLE_MS);
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await page.keyboard.press('Escape');
  await expect(polite(page)).toHaveText('Nothing selected.');
});

test('D4 A6 an Escape on a focus tip leaves the hover tip of its control free to open later', async ({
  page,
}) => {
  await openPage(page);
  const hand = toolButton(page, 'Hand');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(tip(page)).toHaveText(/^Hand\s*H$/u);
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  const [x, y] = await centreOf(hand);
  await page.mouse.move(x, y);
  await expect(tip(page)).toHaveText(/^Hand\s*H$/u);
});

test('D4 D6 A6 a hover tooltip appears after its delay and closes when the pointer leaves', async ({
  page,
}) => {
  await openPage(page);
  const rectangle = toolButton(page, 'Rectangle');
  const [x, y] = await centreOf(rectangle);
  await page.mouse.move(x, y);
  const start = Date.now();
  await page.waitForTimeout(250);
  await expect(tip(page)).toHaveCount(0);
  await expect(tip(page)).toBeVisible();
  expect(Date.now() - start).toBeGreaterThanOrEqual(450);
  await expect(tip(page)).toHaveText(/^Rectangle\s*R\s*or\s*2$/u);
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(tip(page)).toHaveCount(0);
  await page.mouse.move(x, y);
  await expect(tip(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  await expect(rectangle).toHaveAttribute('aria-pressed', 'false');
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('D4 A6 a tap never opens a tooltip, while it still chooses the tool', async ({ page }) => {
    await openPage(page);
    const rectangle = toolButton(page, 'Rectangle');
    await expect(async () => {
      await rectangle.tap();
      await expect(rectangle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    }).toPass();
    await page.waitForTimeout(800);
    await expect(tip(page)).toHaveCount(0);
  });
});
