import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { expectChrome, expectInk, moreButton, overlayInk, toolButton, touch } from './drawing.ts';
import { canvasBox } from './support.ts';

// Drawing and then selecting on an emulated phone (ENG-11): a 412 x 915 viewport at a device pixel
// ratio of 2.625, as a mobile page with touch, driven by one finger. The tools are chosen by
// tapping the tool bar, which is the phone's dock at the window's bottom (the v0.2 plan's S8), with
// Hand, Diamond and Tool lock in its More. B-01's touch drag (120,250) to (260,350) gave the box
// [120,250,140,100]. Every touch lies between the top bar, about 62 px high, and history and zoom
// above the dock, which start about 124 px above the window's bottom (ADR 0012's row for pointer
// tests); the pair and the locked diamonds, drawn 200 px lower than ENG-11 drew them when the tool
// bar wrapped at the top, stay where they were.

test.use({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  const box = await canvasBox(page);
  expect(box.width).toBeGreaterThanOrEqual(320);
  expect(box.height).toBeGreaterThanOrEqual(360);
});

const pressed = (page: Page, name: string) =>
  expect(toolButton(page, name)).toHaveAttribute('aria-pressed', 'true');

/** The tools that the dock's More holds, whose state shows on More while they are active (S8). */
const IN_MORE = new Set(['Hand', 'Diamond']);

/** Taps More until its popover is open, since a tap after a touch can be lost. */
async function openMore(page: Page): Promise<void> {
  await expect(async () => {
    if ((await moreButton(page).getAttribute('aria-expanded')) !== 'true') {
      await moreButton(page).tap();
    }
    await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass();
}

/** The diamond is the active tool: More shows its glyph, pressed. */
async function diamondOnMore(page: Page): Promise<void> {
  await expect(moreButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(moreButton(page).locator('svg[data-glyph="diamond"]')).toHaveCount(1);
}

/**
 * Taps a tool's button, in More for Hand and Diamond, until the tool shows as pressed, on More for
 * those two: under load a tap that follows a touch drag can be lost, and tapping the active tool
 * again changes nothing.
 */
async function choose(page: Page, name: string): Promise<void> {
  const held = IN_MORE.has(name);
  await expect(async () => {
    if (held) await openMore(page);
    await toolButton(page, name).tap();
    await expect(held ? moreButton(page) : toolButton(page, name)).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 1000 },
    );
  }).toPass();
}

/** The rectangle [40,240,100,80] and the ellipse [190,370,100,80], drawn by touch drags. */
async function drawPair(page: Page) {
  await choose(page, 'Rectangle');
  await touch(page, [40, 240], [140, 320]);
  await choose(page, 'Ellipse');
  await touch(page, [190, 370], [290, 450]);
}

/** The rectangle's south-east corner, the ellipse's north-west one and the pair's north-east. */
const PROBES = { rectangle: [140, 320], ellipse: [190, 370], both: [290, 240] } as const;

test('A1 A4 a touch drag draws B-01’s touch box, and the Selection tool selects it', async ({
  page,
}) => {
  await choose(page, 'Rectangle');
  await touch(page, [120, 250], [260, 350]);
  await expectInk(page, [
    [120, 300],
    [260, 300],
    [190, 250],
    [190, 350],
  ]);
  await expectInk(
    page,
    [
      [117, 300],
      [263, 300],
      [190, 300],
    ],
    false,
  );
  await pressed(page, 'Selection');
  await expectChrome(page, { nw: [120, 250], se: [260, 350] }, ['nw', 'se']);
});

test('A15 to A20 drawn elements are selected by a press, Shift+press, marquee and Mod+A, and cleared by an empty press and Escape', async ({
  page,
}) => {
  await drawPair(page);
  await expectChrome(page, PROBES, ['ellipse']);
  await touch(page, [40, 280]);
  await expectChrome(page, PROBES, ['rectangle']);
  await touch(page, [290, 410], [290, 410], true);
  await expectChrome(page, PROBES, ['both']);
  await touch(page, [40, 280], [40, 280], true);
  await expectChrome(page, PROBES, ['ellipse']);
  await touch(page, [20, 220], [160, 340]);
  await expectChrome(page, PROBES, ['rectangle']);
  await touch(page, [20, 220], [310, 470]);
  await expectChrome(page, PROBES, ['both']);
  await touch(page, [300, 530]);
  await expectChrome(page, PROBES, []);
  await page.keyboard.press('ControlOrMeta+A');
  await expectChrome(page, PROBES, ['both']);
  await page.keyboard.press('Escape');
  await expectChrome(page, PROBES, []);
});

test('A6 A7 A8 a freehand stroke and a tapped dot, with the tool still active and nothing selected', async ({
  page,
}) => {
  await choose(page, 'Freehand');
  await touch(page, [40, 300], [200, 300]);
  await touch(page, [250, 300]);
  await expectInk(page, [
    [120, 300],
    [250, 300],
  ]);
  await pressed(page, 'Freehand');
  expect(await overlayInk(page)).toBe(0);
});

test('A5 A27 with tool lock the tool stays, nothing is selected, and Undo keeps the tool', async ({
  page,
}) => {
  await openMore(page);
  await toolButton(page, 'Tool lock').tap();
  await openMore(page);
  await expect(toolButton(page, 'Tool lock')).toHaveAttribute('aria-pressed', 'true');
  await choose(page, 'Diamond');
  await touch(page, [40, 240], [140, 340]);
  await touch(page, [190, 240], [290, 340]);
  await expectInk(page, [
    [65, 265],
    [215, 265],
  ]);
  await diamondOnMore(page);
  expect(await overlayInk(page)).toBe(0);
  await page.getByRole('button', { name: 'Undo' }).tap();
  await expectInk(page, [[215, 265]], false);
  await expectInk(page, [[65, 265]]);
  await diamondOnMore(page);
});
