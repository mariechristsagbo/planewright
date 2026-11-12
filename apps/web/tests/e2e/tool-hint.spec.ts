import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { elementsToggle, openElements, openPage, polite, textContrasts } from './a11y.ts';
import { mouseDrag, toolButton } from './drawing.ts';
import { expectPlaced, intersecting, islands } from './layout.ts';
import type { Box, Viewport } from './layout.ts';
import { boxOf, selectionSurface } from './panel.ts';
import { showStaleNotice, storageNotices } from './storage.ts';
import { canvas, canvasBox } from './support.ts';

// The active tool's hint line (ADR 0012, decisions 1 and 3; the v0.2 plan's S10, issue #77's D4 to
// D8): one caption line under the palette saying what the active tool does, centred on it 8 px
// under it on desktops and taking no row there, following the tool however it changes, absent while
// a text is edited, hidden on phones, 5.50:1 on its own opaque backing over any drawing, and letting
// presses through to the canvas. End-to-end files import no application code, so this spec holds
// its own copy of D4's words, by each tool's key. Page code is written as strings, since these files
// compile without the DOM library.

const HINTS: readonly (readonly [key: string, words: string])[] = [
  ['h', 'Drag to pan the view'],
  ['v', 'Select, move, resize or rotate what is drawn'],
  ['r', 'Drag to draw a rectangle; tap for the default size'],
  ['o', 'Drag to draw an ellipse; tap for the default size'],
  ['d', 'Drag to draw a diamond; tap for the default size'],
  ['l', 'Drag to draw a line; tap for a horizontal one'],
  ['p', 'Drag to draw a stroke; tap for a dot'],
  ['t', 'Tap to place a text, then type it'],
];

const SELECTION = 'Select, move, resize or rotate what is drawn';
const RECTANGLE = 'Drag to draw a rectangle; tap for the default size';
const ELLIPSE = 'Drag to draw an ellipse; tap for the default size';

const hint = (page: Page): Locator => page.locator('#tool-hint');

/** The hint's box, named as the layout's boxes are. */
const hintBox = async (page: Page): Promise<Box> => ({
  name: 'tool-hint',
  ...(await boxOf(hint(page))),
});

/** The pairs of the hint and an island, the selection panel, the notices or the drawer that meet. */
async function hintMeets(page: Page): Promise<string[]> {
  const pairs = intersecting([await hintBox(page), ...(await islands(page))]);
  return pairs.filter((pair) => pair.startsWith('tool-hint'));
}

const DESKTOPS: readonly Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1200, height: 800 },
];

for (const viewport of DESKTOPS) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('D4 D5 A6 shows Selection’s words at load, then each tool’s words after its key on the focused canvas', async ({
      page,
    }) => {
      await openPage(page);
      await expect(hint(page)).toHaveText(SELECTION);
      await canvas(page).focus();
      for (const [key, words] of HINTS) {
        await page.keyboard.press(key);
        await expect(hint(page)).toHaveText(words);
      }
    });

    test('D6 A7 the hint is centred on the palette, 8 px under it and 18 px high, and the panel and the notices keep their places', async ({
      page,
    }) => {
      await openPage(page);
      const palette = await boxOf(page.locator('[data-island="tools"]'));
      const line = await boxOf(hint(page));
      expect(
        Math.abs(line.x + line.width / 2 - (palette.x + palette.width / 2)),
      ).toBeLessThanOrEqual(1);
      expect(Math.abs(line.y - (palette.y + palette.height + 8))).toBeLessThanOrEqual(1);
      expect(line.height).toBeCloseTo(18, 1);
      await showStaleNotice(page);
      const identity = await boxOf(page.locator('[data-island="identity"]'));
      const panel = await boxOf(selectionSurface(page));
      const notices = await boxOf(storageNotices(page));
      expect([panel.x, panel.y]).toEqual([16, 72]);
      expect(notices.y).toBe(identity.y + identity.height + 8);
    });

    test('D6 A7 no hint meets an island, the panel, the notices or the drawer, under the stale notice with the drawer open', async ({
      page,
    }) => {
      await openPage(page);
      await showStaleNotice(page);
      await openElements(page);
      // Selection's words beside the selection panel first, then every tool's.
      await expect(selectionSurface(page)).toBeVisible();
      await expect(hint(page)).toHaveText(SELECTION);
      expect(await hintMeets(page)).toEqual([]);
      for (const [key, words] of HINTS) {
        await canvas(page).focus();
        await page.keyboard.press(key);
        await expect(hint(page)).toHaveText(words);
        expect(await hintMeets(page), words).toEqual([]);
      }
    });
  });
}

test('D5 A6 the hint follows the tool: back to Selection after a creation, kept by tool lock, and from the palette', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.keyboard.press('r');
  await expect(hint(page)).toHaveText(RECTANGLE);
  await page.keyboard.press('Enter');
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await expect(hint(page)).toHaveText(SELECTION);
  for (const key of ['q', 'r', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Rectangle created. Nothing selected.');
  await expect(hint(page)).toHaveText(RECTANGLE);
  await toolButton(page, 'Ellipse').click();
  await expect(hint(page)).toHaveText(ELLIPSE);
});

test('D5 A9 a text session removes the hint, and Escape brings Selection’s words back', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.keyboard.press('t');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Text' })).toBeFocused();
  await expect(hint(page)).toHaveCount(0);
  await page.keyboard.type('Plan');
  await page.keyboard.press('Escape');
  await expect(polite(page)).toHaveText('Text created. 1 element selected.');
  await expect(hint(page)).toHaveText(SELECTION);
});

/**
 * The highest contrast that a pixel of a PNG has against white, decoded in the page: the hint's
 * own words reach their colour's 5.50:1 at most, while a darker stroke showing through would reach
 * more.
 */
const DARKEST = (png: string) => `(async () => {
  const image = new Image();
  image.src = 'data:image/png;base64,${png}';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, image.width, image.height);
  const linear = (value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  let best = 1;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = 0.2126 * linear(data[index]) + 0.7152 * linear(data[index + 1]) + 0.0722 * linear(data[index + 2]);
    best = Math.max(best, 1.05 / (luminance + 0.05));
  }
  return best;
})()`;

test('D6 A12 the words are 5.50:1 on their own backing, also over a rectangle drawn across their band', async ({
  page,
}) => {
  await openPage(page);
  // textContrasts gives each text's first 40 characters.
  const ratioOf = async () =>
    (await textContrasts(page)).find(({ text }) => text === SELECTION.slice(0, 40))?.ratio;
  expect(await ratioOf()).toBe(5.5);
  await canvas(page).focus();
  await page.keyboard.press('r');
  const line = await boxOf(hint(page));
  const box = await canvasBox(page);
  // A rectangle whose top edge runs through the band from left of the hint to its centre, and
  // whose right edge runs down from there.
  await mouseDrag(
    page,
    [line.x - 40 - box.x, line.y + line.height + 80 - box.y],
    [line.x + line.width / 2 - box.x, line.y + line.height / 2 - box.y],
  );
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await expect(hint(page)).toHaveText(SELECTION);
  expect(await ratioOf()).toBe(5.5);
  const png = await page.screenshot({ clip: await boxOf(hint(page)), animations: 'disabled' });
  const darkest = await page.evaluate<number>(DARKEST(png.toString('base64')));
  test.info().annotations.push({ type: 'darkest pixel', description: darkest.toFixed(2) });
  expect(darkest).toBeGreaterThan(3);
  expect(darkest).toBeLessThanOrEqual(5.6);
});

test('D5 A10 a press on the hint reaches the canvas: with Rectangle, a click at its centre draws one', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.keyboard.press('r');
  const line = await boxOf(hint(page));
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2);
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
});

/** The bottom of the top row: its three islands' lowest bottom. */
async function topRowBottom(page: Page): Promise<number> {
  const boxes = await islands(page);
  const top = boxes.filter(({ name }) => ['identity', 'tools', 'top-right'].includes(name));
  expect(top).toHaveLength(3);
  return Math.max(...top.map(({ y, height }) => y + height));
}

const COMPACT: readonly (Viewport & { readonly touch: boolean })[] = [
  { width: 1199, height: 800, touch: false },
  { width: 800, height: 720, touch: false },
  { width: 600, height: 800, touch: false },
  { width: 1024, height: 768, touch: true },
];

for (const { width, height, touch } of COMPACT) {
  test.describe(`at ${String(width)} × ${String(height)}${touch ? ' with touch' : ''}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch });

    test('D7 A8 the hint owns an 18 px row under the top row, centred in the window, and the panel, the notices and the drawer start 26 px lower', async ({
      page,
    }) => {
      await openPage(page);
      // Measured from the top row's bottom, which is the identity island's unless the palette
      // wraps, as it does at 600 px wide.
      const identity = await boxOf(page.locator('[data-island="identity"]'));
      const atRest = await topRowBottom(page);
      test.info().annotations.push({
        type: 'top row',
        description: `bottom ${String(atRest)}, identity island's bottom ${String(identity.y + identity.height)}`,
      });
      const line = await boxOf(hint(page));
      expect(line.y).toBe(atRest + 8);
      expect(line.height).toBeCloseTo(18, 1);
      expect(Math.abs(line.x + line.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      await showStaleNotice(page);
      const top = await topRowBottom(page);
      expect((await boxOf(hint(page))).y).toBe(top + 8);
      const panel = await boxOf(selectionSurface(page));
      const notices = await boxOf(storageNotices(page));
      // 2 px under the notices' row, as S6 placed it, and 8 px under the hint's row.
      expect([panel.y, notices.y]).toEqual([top + 36, top + 34]);
      await openElements(page);
      const drawer = await boxOf(page.locator('#element-list-drawer'));
      expect(drawer.y).toBe(notices.y + notices.height + 8);
      expect(await hintMeets(page)).toEqual([]);
    });
  });
}

for (const viewport of [
  { width: 800, height: 720 },
  { width: 800, height: 520 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}, with the stale notice, a selection and the drawer`, () => {
    test.use({ viewport });

    test('D7 A15 every island lies inside the window and apart, and the hint meets none', async ({
      page,
    }) => {
      await openPage(page);
      await showStaleNotice(page);
      await openElements(page);
      await expect(selectionSurface(page)).toBeVisible();
      await expectPlaced(page, viewport, 8);
      expect(await hintMeets(page)).toEqual([]);
    });
  });
}

test.describe('at 800 × 720, a text session', () => {
  test.use({ viewport: { width: 800, height: 720 } });

  test('D7 A8 A9 removes the hint and moves neither the notices nor the drawer; Escape brings Selection’s words back', async ({
    page,
  }) => {
    await openPage(page);
    await showStaleNotice(page);
    await openElements(page);
    const tops = async () => [
      (await boxOf(storageNotices(page))).y,
      (await boxOf(page.locator('#element-list-drawer'))).y,
    ];
    const before = await tops();
    await canvas(page).focus();
    await page.keyboard.press('t');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Text' })).toBeFocused();
    await expect(hint(page)).toHaveCount(0);
    await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'true');
    expect(await tops()).toEqual(before);
    await page.keyboard.type('Plan');
    await page.keyboard.press('Escape');
    await expect(hint(page)).toHaveText(SELECTION);
    expect(await tops()).toEqual(before);
  });
});

const PHONES: readonly Viewport[] = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
];

for (const viewport of PHONES) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('D8 A9 the hint is hidden, and out of the accessibility tree', async ({ page }) => {
      await openPage(page);
      await expect(hint(page)).toHaveCount(1);
      await expect(hint(page)).toBeHidden();
      expect(await page.locator('body').ariaSnapshot()).not.toContain(SELECTION);
    });

    test('D8 A9 the hint adds no row: the notices start one gap under the row above them', async ({
      page,
    }) => {
      await openPage(page);
      await showStaleNotice(page);
      await expect(hint(page)).toBeHidden();
      const notices = await boxOf(storageNotices(page));
      // The rows above the notices: the top row, and the tool bar's or the selection bar's
      // own row where a phone's layout gives one.
      const above = (await islands(page)).filter(
        ({ name, y }) => name !== 'Storage notices' && y < notices.y,
      );
      const gap = viewport.height < 500 ? 4 : 8;
      expect(notices.y - Math.max(...above.map(({ y, height }) => y + height))).toBe(gap);
    });
  });
}
