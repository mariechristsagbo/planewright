import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { channels, contrast, openPage, polite } from './a11y.ts';
import { mouseClick } from './drawing.ts';
import { intersecting, islands } from './layout.ts';
import type { Viewport } from './layout.ts';
import { boxOf } from './panel.ts';
import { canvas } from './support.ts';

// The canvas's focus ring and chip (ADR 0012, decisions 3 and 14; the v0.2 plan's S10, issue #77's
// D1 to D3): keyboard focus on the canvas shows 2 px of the focus ring's violet at the window's
// edges, inset by the safe areas, over a 2 px white halo, and a "Canvas focused" chip at the bottom
// centre, level with the bottom islands, hidden from assistive technology and on phones. They show
// exactly while the canvas host matches :focus-visible: never after a mouse press, nor while
// another element has the focus, and again after Escape from the text area; and presses go through
// them to the canvas. Page code is written as strings, since these files compile without the DOM
// library.

const VIOLET = [101, 71, 180];
const WHITE = [255, 255, 255];

type Edges = Readonly<Record<'top' | 'right' | 'bottom' | 'left', number[][]>>;

/** From each edge inward: 2 px of the ring, then 2 px of its halo. */
const RING_PIXELS = [VIOLET, VIOLET, WHITE, WHITE];

/**
 * Whether four pixels inward from an edge are the ring's, each channel within 4 levels, since an
 * island's shadow, which lies over the canvas's layer, darkens a phone's bottom edge by 1 or 2.
 */
const isRing = (pixels: readonly number[][]): boolean =>
  pixels.length === RING_PIXELS.length &&
  pixels.every((pixel, index) =>
    pixel.every((channel, at) => Math.abs(channel - (RING_PIXELS[index]?.[at] ?? -9)) <= 4),
  );

/** The edges, by name, whose middle shows no ring. */
const withoutRing = (edges: Edges): string[] =>
  Object.entries(edges)
    .filter(([, pixels]) => !isRing(pixels))
    .map(([edge]) => edge);

const ring = (page: Page): Locator => page.locator('#drawing-canvas ~ .canvas-focus-ring');
const chip = (page: Page): Locator => page.getByText('Canvas focused', { exact: true });

/** Tabs from the page's start to the canvas: the menu, Pre-release, the tool bar's stop, the canvas. */
async function tabToCanvas(page: Page): Promise<void> {
  for (let stop = 0; stop < 4; stop += 1) await page.keyboard.press('Tab');
  await expect(canvas(page)).toBeFocused();
}

/** The first four pixels inward from the middle of each edge of a PNG of the window. */
const EDGES = (png: string) => `(async () => {
  const image = new Image();
  image.src = 'data:image/png;base64,${png}';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const at = (x, y) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
  const [x, y] = [Math.floor(image.width / 2), Math.floor(image.height / 2)];
  const inward = (pixel) => [0, 1, 2, 3].map(pixel);
  return {
    top: inward((step) => at(x, step)),
    right: inward((step) => at(image.width - 1 - step, y)),
    bottom: inward((step) => at(x, image.height - 1 - step)),
    left: inward((step) => at(step, y)),
  };
})()`;

/** What the window shows at the middle of each edge, recorded on the test's report. */
async function edgesOf(page: Page): Promise<Edges> {
  const png = await page.screenshot({ scale: 'css', animations: 'disabled' });
  const edges = await page.evaluate<Edges>(EDGES(png.toString('base64')));
  test.info().annotations.push({ type: 'edge pixels', description: JSON.stringify(edges) });
  return edges;
}

/** The ring's computed outline and halo, and the canvas's background behind it. */
const RING_STYLE = `(() => {
  const style = getComputedStyle(document.querySelector('#drawing-canvas ~ .canvas-focus-ring'));
  const host = getComputedStyle(document.getElementById('drawing-canvas'));
  return {
    outline: [style.outlineStyle, style.outlineWidth, style.outlineOffset].join(' '),
    colour: style.outlineColor,
    halo: style.boxShadow,
    canvas: host.backgroundColor,
    hostOutline: host.outlineStyle,
    events: style.pointerEvents,
  };
})()`;

interface RingStyle {
  readonly outline: string;
  readonly colour: string;
  readonly halo: string;
  readonly canvas: string;
  readonly hostOutline: string;
  readonly events: string;
}

/** The chip's text and background colours, and whether it takes presses. */
const CHIP_STYLE = `(() => {
  const style = getComputedStyle(document.querySelector('.canvas-focus-chip'));
  return { colour: style.color, background: style.backgroundColor, events: style.pointerEvents };
})()`;

const DESKTOPS: readonly (Viewport & { readonly touch: boolean })[] = [
  { width: 1440, height: 900, touch: false },
  { width: 1280, height: 720, touch: false },
  { width: 800, height: 720, touch: false },
  { width: 1024, height: 768, touch: true },
];

for (const { width, height, touch } of DESKTOPS) {
  test.describe(`at ${String(width)} × ${String(height)}${touch ? ' with touch' : ''}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch });

    test('D1 A2 four Tabs reach the canvas, whose ring shows 2 px of violet over a 2 px white halo at the middle of each edge', async ({
      page,
    }) => {
      await openPage(page);
      await expect(ring(page)).toBeHidden();
      await tabToCanvas(page);
      expect(withoutRing(await edgesOf(page))).toEqual([]);
      const style = await page.evaluate<RingStyle>(RING_STYLE);
      expect(style).toEqual({
        outline: 'solid 2px -2px',
        colour: 'rgb(101, 71, 180)',
        halo: 'rgb(255, 255, 255) 0px 0px 0px 4px inset',
        canvas: 'rgb(255, 255, 255)',
        hostOutline: 'none',
        events: 'none',
      });
      expect(contrast(channels(style.colour), channels(style.canvas))).toBeGreaterThanOrEqual(3);
      expect(await boxOf(ring(page))).toEqual({ x: 0, y: 0, width, height });
      expect(await page.evaluate<number>('document.getAnimations().length')).toBe(0);
    });

    test('D2 A3 "Canvas focused" shows white on the inverse surface, centred, level with the bottom islands, meeting none, and out of the accessibility tree', async ({
      page,
    }) => {
      await openPage(page);
      await expect(chip(page)).toBeHidden();
      await tabToCanvas(page);
      await expect(chip(page)).toBeVisible();
      expect(await page.evaluate(CHIP_STYLE)).toEqual({
        colour: 'rgb(255, 255, 255)',
        background: 'rgb(29, 29, 39)',
        events: 'none',
      });
      const box = await boxOf(chip(page));
      const history = await boxOf(page.locator('[data-island="bottom-left"]'));
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y + box.height - (history.y + history.height))).toBeLessThanOrEqual(1);
      const pairs = intersecting([{ name: 'chip', ...box }, ...(await islands(page))]);
      expect(pairs.filter((pair) => pair.startsWith('chip'))).toEqual([]);
      expect(await page.locator('body').ariaSnapshot()).not.toContain('Canvas focused');
    });

    test('D3 A4 Shift+Tab hides the ring and the chip, and Tab shows them again', async ({
      page,
    }) => {
      await openPage(page);
      await tabToCanvas(page);
      await expect(ring(page)).toBeVisible();
      await expect(chip(page)).toBeVisible();
      await page.keyboard.press('Shift+Tab');
      await expect(canvas(page)).not.toBeFocused();
      await expect(ring(page)).toBeHidden();
      await expect(chip(page)).toBeHidden();
      await page.keyboard.press('Tab');
      await expect(canvas(page)).toBeFocused();
      await expect(ring(page)).toBeVisible();
      await expect(chip(page)).toBeVisible();
    });

    test('D3 A4 a mouse press on an empty point focuses the canvas with neither showing', async ({
      page,
    }) => {
      await openPage(page);
      await mouseClick(page, [width / 2, height / 2 + 120]);
      await expect(canvas(page)).toBeFocused();
      await expect(ring(page)).toBeHidden();
      await expect(chip(page)).toBeHidden();
    });

    test('D3 A4 neither shows while the text area has the focus, and both show on the canvas after Escape', async ({
      page,
    }) => {
      await openPage(page);
      await tabToCanvas(page);
      await page.keyboard.press('t');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Text' })).toBeFocused();
      await expect(ring(page)).toBeHidden();
      await expect(chip(page)).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(canvas(page)).toBeFocused();
      await expect(ring(page)).toBeVisible();
      await expect(chip(page)).toBeVisible();
    });

    test('D3 A10 with the ring showing, r and a mouse drag from the chip draw a rectangle', async ({
      page,
    }) => {
      await openPage(page);
      await tabToCanvas(page);
      await page.keyboard.press('r');
      await expect(chip(page)).toBeVisible();
      const box = await boxOf(chip(page));
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 120, y - 150, { steps: 8 });
      await page.mouse.up();
      await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
    });
  });
}

test.describe('at 1440 × 900 with safe-area insets', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('D1 A2 the ring lies inset by the insets, and the chip stays level with the bottom islands', async ({
    page,
  }) => {
    const insets = { top: 47, right: 34, bottom: 21, left: 21 };
    await openPage(page);
    const sides = Object.entries(insets).map(
      ([side, value]) => `style.setProperty('--shell-safe-${side}', '${String(value)}px');`,
    );
    await page.evaluate(
      `(() => { const { style } = document.documentElement; ${sides.join(' ')} })()`,
    );
    await tabToCanvas(page);
    expect(await boxOf(ring(page))).toEqual({
      x: insets.left,
      y: insets.top,
      width: 1440 - insets.left - insets.right,
      height: 900 - insets.top - insets.bottom,
    });
    const box = await boxOf(chip(page));
    const history = await boxOf(page.locator('[data-island="bottom-left"]'));
    expect(Math.abs(box.y + box.height - (history.y + history.height))).toBeLessThanOrEqual(1);
  });
});

const PHONES: readonly Viewport[] = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

for (const viewport of PHONES) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('D8 A2 A3 the canvas stop shows the ring at the middle of each edge and no chip', async ({
      page,
    }) => {
      await openPage(page);
      await tabToCanvas(page);
      expect(withoutRing(await edgesOf(page))).toEqual([]);
      await expect(chip(page)).toHaveCount(1);
      await expect(chip(page)).toBeHidden();
    });
  });
}
