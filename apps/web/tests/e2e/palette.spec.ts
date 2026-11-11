import { expect, test } from '@playwright/test';

import { openPage } from './a11y.ts';
import { toolButton } from './drawing.ts';

// The palette (ADR 0012, decision 3, and the v0.2 plan's S3): tool lock's padlock is closed while
// tool lock is on, as its pressed state says, and toggling it from the keyboard changes both; at a
// compact width each button's corner key keeps clear of its glyph.

/**
 * Each palette button's corner key and the bounds that its glyph paints, in CSS pixels: every
 * shape's box on the 20 px grid, widened by half the stroke for a stroked shape, then scaled to the
 * drawn glyph. Page code is written as a string, since these files compile without the DOM library.
 */
const CORNERS = `[...document.querySelectorAll('[role="toolbar"] button')].map((button) => {
  const svg = button.querySelector('svg');
  const box = svg.getBoundingClientRect();
  const scale = box.width / 20;
  const shapes = [...svg.children].map((shape) => {
    const b = shape.getBBox();
    const half = getComputedStyle(shape).stroke === 'none' ? 0 : parseFloat(getComputedStyle(shape).strokeWidth) / 2;
    return [b.x - half, b.y - half, b.x + b.width + half, b.y + b.height + half];
  });
  const glyph = [
    box.x + Math.min(...shapes.map((s) => s[0])) * scale,
    box.y + Math.min(...shapes.map((s) => s[1])) * scale,
    box.x + Math.max(...shapes.map((s) => s[2])) * scale,
    box.y + Math.max(...shapes.map((s) => s[3])) * scale,
  ];
  const k = button.querySelector('kbd').getBoundingClientRect();
  return { name: button.getAttribute('aria-label'), size: button.getBoundingClientRect().width, glyph, key: [k.x, k.y, k.right, k.bottom] };
})`;

type Box = readonly [left: number, top: number, right: number, bottom: number];

interface Corner {
  readonly name: string;
  readonly size: number;
  readonly glyph: Box;
  readonly key: Box;
}

/** Whether two boxes share any area. */
const overlap = (a: Box, b: Box): boolean =>
  a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

test('A4 REQ-Y01 the padlock closes and opens with tool lock from the keyboard, with aria-pressed', async ({
  page,
}) => {
  await openPage(page);
  const lock = toolButton(page, 'Tool lock');
  const padlock = lock.locator('svg[data-glyph]');
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await expect(padlock).toHaveAttribute('data-glyph', 'lock-open');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(toolButton(page, 'Hand')).toBeFocused();
  await page.keyboard.press('End');
  await expect(lock).toBeFocused();
  for (const [key, pressed, glyph] of [
    ['Space', 'true', 'lock-closed'],
    ['Enter', 'false', 'lock-open'],
    ['q', 'true', 'lock-closed'],
    ['q', 'false', 'lock-open'],
  ] as const) {
    await page.keyboard.press(key);
    await expect(lock).toHaveAttribute('aria-pressed', pressed);
    await expect(padlock).toHaveAttribute('data-glyph', glyph);
    await expect(lock).toHaveAccessibleName('Tool lock');
  }
  await expect(lock).toBeFocused();
});

test.describe('at a compact width, with 32 px glyph buttons', () => {
  test.use({ viewport: { width: 800, height: 720 } });

  test('D2 each corner key’s box keeps clear of the bounds that its glyph paints', async ({
    page,
  }) => {
    await openPage(page);
    const corners = await page.evaluate<Corner[]>(CORNERS);
    expect(corners.map(({ name }) => name)).toEqual([
      'Hand',
      'Selection',
      'Rectangle',
      'Ellipse',
      'Diamond',
      'Line',
      'Freehand',
      'Text',
      'Tool lock',
    ]);
    expect(new Set(corners.map(({ size }) => size))).toEqual(new Set([32]));
    expect(corners.filter(({ glyph, key }) => overlap(glyph, key))).toEqual([]);
  });
});
