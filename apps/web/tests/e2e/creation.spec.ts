import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  colourAt,
  expectChrome,
  expectInk,
  mouseClick,
  mouseDrag,
  overlayInk,
  toolButton,
} from './drawing.ts';
import type { Point } from './drawing.ts';
import { canvas } from './support.ts';

// Drawing and then selecting on the desktop (ENG-11), with the mouse and the keyboard. B-01's drags
// and boxes are the numbers committed in behavior-analysis.md; a box shows as ink on its edges and
// none just outside them, since a 2-unit stroke covers 1 unit on either side of an edge.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await canvas(page).focus();
});

const pressed = (page: Page, name: string) =>
  expect(toolButton(page, name)).toHaveAttribute('aria-pressed', 'true');

/** Ink on a box's four edge midpoints and none 3 units outside its left and right edges. */
async function expectBox(page: Page, [x, y, width, height]: readonly number[]) {
  const [left = 0, top = 0, w = 0, h = 0] = [x, y, width, height];
  const middle = top + h / 2;
  await expectInk(page, [
    [left, middle],
    [left + w, middle],
    [left + w / 2, top],
    [left + w / 2, top + h],
  ]);
  await expectInk(
    page,
    [
      [left - 3, middle],
      [left + w + 3, middle],
      [left + w / 2, middle],
    ],
    false,
  );
}

test('A1 A4 REQ-C01 REQ-C05 B-01: drags by the shortcuts draw the four boxes, and the Selection tool selects the last', async ({
  page,
}) => {
  const drags: readonly (readonly [string, Point, Point])[] = [
    ['r', [300, 180], [420, 280]],
    ['o', [520, 180], [660, 280]],
    ['d', [820, 170], [940, 290]],
    ['l', [300, 420], [420, 420]],
  ];
  for (const [key, from, to] of drags) {
    await page.keyboard.press(key);
    await mouseDrag(page, from, to);
  }
  await expectBox(page, [300, 180, 120, 100]);
  await expectInk(page, [
    [520, 230],
    [660, 230],
    [590, 180],
    [590, 280],
  ]);
  // The diamond's corners are round, so its edges are probed between them.
  await expectInk(page, [
    [910, 200],
    [850, 260],
  ]);
  await expectInk(page, [[360, 420]]);
  await expectInk(
    page,
    [
      [360, 425],
      [590, 230],
      [880, 230],
    ],
    false,
  );
  await pressed(page, 'Selection');
  await expectChrome(page, { start: [300, 420], end: [420, 420], rectangle: [300, 180] }, [
    'start',
    'end',
  ]);
});

test('A2 REQ-C02 a drag towards the top-left draws the same box', async ({ page }) => {
  await toolButton(page, 'Ellipse').click();
  await mouseDrag(page, [660, 280], [520, 180]);
  await expectInk(page, [
    [520, 230],
    [660, 230],
  ]);
  await expectInk(
    page,
    [
      [517, 230],
      [663, 230],
    ],
    false,
  );
  await expectChrome(page, { nw: [520, 180], se: [660, 280] }, ['nw', 'se']);
});

test('A3 REQ-C03 REQ-C04 taps draw a 100 x 100 shape and a 100-unit line centred on them', async ({
  page,
}) => {
  await page.keyboard.press('r');
  await mouseClick(page, [400, 300]);
  await expectBox(page, [350, 250, 100, 100]);
  await page.keyboard.press('l');
  await mouseClick(page, [700, 300]);
  await expectInk(page, [[700, 300]]);
  await pressed(page, 'Selection');
  await expectChrome(page, { start: [650, 300], end: [750, 300] }, ['start', 'end']);
});

test('A21 REQ-C12 a new element is drawn in the default stroke colour, #1e2430', async ({
  page,
}) => {
  await page.keyboard.press('r');
  await mouseDrag(page, [300, 180], [420, 280]);
  await expectInk(page, [[300, 230]]);
  // At a device pixel ratio of 1 this pixel lies wholly inside the 2-unit stroke.
  expect(await colourAt(page, [300, 230])).toEqual([30, 36, 48]);
});

test('A5 A27 REQ-C05 REQ-H05 with tool lock the tool stays, nothing is selected, and Undo keeps the tool', async ({
  page,
}) => {
  await toolButton(page, 'Tool lock').click();
  await expect(toolButton(page, 'Tool lock')).toHaveAttribute('aria-pressed', 'true');
  await toolButton(page, 'Rectangle').click();
  await mouseDrag(page, [100, 100], [200, 180]);
  await mouseDrag(page, [300, 100], [400, 180]);
  await expectInk(page, [
    [100, 140],
    [300, 140],
  ]);
  await pressed(page, 'Rectangle');
  expect(await overlayInk(page)).toBe(0);
  await page.keyboard.press('ControlOrMeta+Z');
  await expectInk(page, [[300, 140]], false);
  await expectInk(page, [[100, 140]]);
  await pressed(page, 'Rectangle');
  await page.keyboard.press('q');
  await expect(toolButton(page, 'Tool lock')).toHaveAttribute('aria-pressed', 'false');
});

test('A6 A7 A8 REQ-C06 REQ-C07 the freehand tool draws a stroke and a dot and stays active with nothing selected', async ({
  page,
}) => {
  await page.keyboard.press('p');
  await mouseDrag(page, [100, 300], [300, 300]);
  await mouseClick(page, [400, 300]);
  await expectInk(page, [
    [200, 300],
    [400, 300],
  ]);
  await expectInk(
    page,
    [
      [200, 305],
      [404, 300],
    ],
    false,
  );
  await pressed(page, 'Freehand');
  expect(await overlayInk(page)).toBe(0);
});
