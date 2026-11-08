import { expect, test } from '@playwright/test';

import {
  canvas,
  canvasBox,
  cameraOf,
  expectCamera,
  expectHistoryDisabled,
  readout,
} from './support.ts';

// Navigation on the editor surface (ENG-08): every camera input moves the camera as
// docs/architecture/engine/scene-and-viewport.md specifies, in any tool, and never enters the history.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
});

test('REQ-V01 the wheel pans vertically and Shift+wheel horizontally', async ({ page }) => {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.wheel(0, 200);
  await expect(readout(page)).toHaveText('View: x 0, y 200, zoom 100%');
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 200);
  await page.keyboard.up('Shift');
  await expect(readout(page)).toHaveText('View: x 200, y 200, zoom 100%');
  await expectHistoryDisabled(page);
});

test('REQ-V04 REQ-V05 Ctrl+wheel zooms about the pointer, which keeps its scene point', async ({
  page,
}) => {
  const box = await canvasBox(page);
  const at = { x: 300, y: 200 };
  await page.mouse.move(box.x + at.x, box.y + at.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  const zoom = Math.exp(0.1);
  await expectCamera(page, { x: at.x - at.x / zoom, y: at.y - at.y / zoom, zoom });
  await expectHistoryDisabled(page);
});

test('REQ-V02 keyboard zoom keeps the canvas centre, and reset returns to 100 %', async ({
  page,
}) => {
  const box = await canvasBox(page);
  await canvas(page).focus();
  const centre = { x: box.width / 2, y: box.height / 2 };
  await page.keyboard.press('Control+Equal');
  await expectCamera(page, {
    x: centre.x - centre.x / 1.1,
    y: centre.y - centre.y / 1.1,
    zoom: 1.1,
  });
  await page.keyboard.press('Control+Minus');
  await page.keyboard.press('Control+Minus');
  await expectCamera(page, {
    x: centre.x - centre.x / 0.9,
    y: centre.y - centre.y / 0.9,
    zoom: 0.9,
  });
  await page.keyboard.press('Control+Digit0');
  await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
  await expectHistoryDisabled(page);
});

test('REQ-V06 Space+drag pans by the pointer delta and leaves the tool unchanged', async ({
  page,
}) => {
  const box = await canvasBox(page);
  await canvas(page).focus();
  await page.keyboard.down('Space');
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 250, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect(readout(page)).toHaveText('View: x 100, y 50, zoom 100%');
  await expect(page.getByRole('button', { name: 'Selection' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 250, { steps: 5 });
  await page.mouse.up();
  await expect(readout(page)).toHaveText('View: x 100, y 50, zoom 100%');
  await expectHistoryDisabled(page);
});

test('REQ-V06 a middle-button drag pans by the pointer delta', async ({ page }) => {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 360, box.y + 220, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  await expect(readout(page)).toHaveText('View: x -60, y 80, zoom 100%');
  await expectHistoryDisabled(page);
});

test('REQ-V06 the Hand tool pans by the pointer delta, chosen by its button or H', async ({
  page,
}) => {
  const box = await canvasBox(page);
  const hand = page.getByRole('button', { name: 'Hand', exact: true });
  await hand.click();
  await expect(hand).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 250, box.y + 250, { steps: 5 });
  await page.mouse.up();
  await expect(readout(page)).toHaveText('View: x -50, y -50, zoom 100%');
  await page.getByRole('button', { name: 'Selection' }).click();
  await canvas(page).focus();
  await page.keyboard.press('h');
  await expect(hand).toHaveAttribute('aria-pressed', 'true');
  await expectHistoryDisabled(page);
});

test('REQ-C11 a press on the tool bar never reaches the canvas, even dragged onto it', async ({
  page,
}) => {
  const box = await canvasBox(page);
  const hand = page.getByRole('button', { name: 'Hand', exact: true });
  await hand.click();
  const button = await hand.boundingBox();
  if (button === null) throw new Error('The Hand button is not laid out.');
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await cameraOf(page)).toEqual({ x: 0, y: 0, zoom: 1 });
  await expect(canvas(page)).not.toBeFocused();
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('REQ-V07 two fingers pinch about their midpoint and pan by its delta', async ({ page }) => {
    const box = await canvasBox(page);
    const client = await page.context().newCDPSession(page);
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const fingers = (spread: number, up: number) =>
      [-1, 1].map((side, id) => ({ x: centre.x + side * spread, y: centre.y - up, id }));
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: fingers(50, 0),
    });
    for (const spread of [60, 75, 90, 100]) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: fingers(spread, 0),
      });
    }
    const local = { x: box.width / 2, y: box.height / 2 };
    await expectCamera(page, { x: local.x / 2, y: local.y / 2, zoom: 2 });
    for (const up of [20, 40, 60, 80]) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: fingers(100, up),
      });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expectCamera(page, { x: local.x / 2, y: local.y / 2 + 40, zoom: 2 });
    await expect(page.getByRole('button', { name: 'Selection' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expectHistoryDisabled(page);
  });
});
