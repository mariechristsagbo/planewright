import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { overlayInk, toolButton, touch } from './drawing.ts';
import type { Point } from './drawing.ts';
import { canvasBox } from './support.ts';
import { expectInkIn, expectTextAreaAt, textArea } from './text.ts';

// The Text tool on an emulated phone (ENG-12): a 412 x 915 viewport at a device pixel ratio of
// 2.625, as a mobile page with touch, driven by one finger and the keyboard. On mobile, B-06's tap
// at (60,300) with the word Plan typed and a tap on empty canvas gave a text [60,287.5,40.5,25] and
// left nothing selected.

test.use({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
});

const PLAN = [60, 287, 30, 26] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  const box = await canvasBox(page);
  expect(box.width).toBeGreaterThanOrEqual(320);
  expect(box.height).toBeGreaterThanOrEqual(360);
});

/** Taps a tool bar button until it shows as pressed, as the creation tests do (ENG-11). */
async function choose(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await toolButton(page, name).tap();
    await expect(toolButton(page, name)).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
  }).toPass();
}

/** Two quick taps at one canvas point, 100 ms apart, which the editor takes as a double tap. */
async function doubleTap(page: Page, [x, y]: Point): Promise<void> {
  const box = await canvasBox(page);
  const client = await page.context().newCDPSession(page);
  const touchPoints = [{ x: box.x + x, y: box.y + y, id: 0 }];
  for (let tap = 0; tap < 2; tap += 1) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (tap === 0) await page.waitForTimeout(100);
  }
  await client.detach();
  await page.waitForTimeout(350);
}

/**
 * Chooses the Text tool, taps at (60,300) and types the text. The finger rests 350 ms after the
 * tool bar tap, as after every scripted touch: once, a canvas tap that followed it at once was lost.
 */
async function place(page: Page, text: string): Promise<void> {
  await choose(page, 'Text');
  await page.waitForTimeout(350);
  await touch(page, [60, 300]);
  await expectTextAreaAt(page, [60, 300]);
  await page.keyboard.type(text);
}

test('E6 A1 A2 A5 REQ-C09 a tap shows the text area at B-06’s placement, and a tap on empty canvas commits it with nothing selected', async ({
  page,
}) => {
  await place(page, 'Plan');
  await expectInkIn(page, PLAN, false);
  await touch(page, [250, 120]);
  await expect(textArea(page)).toHaveCount(0);
  await expectInkIn(page, PLAN);
  await expectInkIn(page, [20, 287, 38, 26], false);
  await expect(toolButton(page, 'Selection')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => overlayInk(page)).toBe(0);
});

test('E7 A7 A8 REQ-C10 an empty new text leaves Undo disabled, and Undo removes a committed text', async ({
  page,
}) => {
  await place(page, '');
  await touch(page, [250, 120]);
  await expect(textArea(page)).toHaveCount(0);
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeDisabled();
  await place(page, 'Plan');
  await touch(page, [250, 120]);
  await expectInkIn(page, PLAN);
  await expect(async () => {
    await undo.tap();
    await expectInkIn(page, PLAN, false);
  }).toPass();
  await expect(undo).toBeDisabled();
});

test('E8 A9 REQ-C10 a double tap on a text edits it again', async ({ page }) => {
  await place(page, 'Plan');
  await touch(page, [250, 120]);
  await expectInkIn(page, PLAN);
  await doubleTap(page, [75, 300]);
  await expect(textArea(page)).toBeFocused();
  await expect(textArea(page)).toHaveValue('Plan');
  await expectInkIn(page, PLAN, false);
  await page.keyboard.press('End');
  await page.keyboard.type('s');
  await touch(page, [250, 120]);
  await expect(textArea(page)).toHaveCount(0);
  await expectInkIn(page, [92, 287, 12, 26]);
});
