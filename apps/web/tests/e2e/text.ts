import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { canvasBox } from './support.ts';

// What the text tests read from the page (ENG-12): the text area while a text is edited, and the
// scene's ink in a box once it is drawn. Points and boxes are in CSS pixels relative to the scene
// canvas, where the editor's screen space starts.

export type Area = readonly [x: number, y: number, width: number, height: number];

export const textArea = (page: Page): Locator => page.getByRole('textbox', { name: 'Text' });

/** Counts the scene layer's device pixels in a box that are darker than the white canvas. */
const INK_IN = ([x, y, width, height]: Area) =>
  `(() => {
  const canvas = document.querySelectorAll('[aria-label="Drawing canvas"] canvas')[0];
  const ratio = canvas.width / canvas.getBoundingClientRect().width;
  const box = [x, y, width, height].map((value) => Math.round(value * ratio));
  const { data } = canvas.getContext('2d').getImageData(box[0], box[1], box[2], box[3]);
  let ink = 0;
  for (let red = 0; red < data.length; red += 4) if (data[red] < 128) ink += 1;
  return ink;
})()`.replace('[x, y, width, height]', JSON.stringify([x, y, width, height]));

export const inkIn = async (page: Page, area: Area): Promise<number> =>
  Number(await page.evaluate(INK_IN(area)));

/** Waits until the scene shows ink in a box, or none where `false`. */
export async function expectInkIn(page: Page, area: Area, ink = true): Promise<void> {
  await expect.poll(async () => (await inkIn(page, area)) > 0).toBe(ink);
}

/**
 * Waits for the focused text area of a new text placed at a canvas point (REQ-C09, B-06): its left
 * edge at the point and its first line, 25 px high at zoom 1, centred on it.
 */
export async function expectTextAreaAt(page: Page, [x, y]: readonly [number, number]) {
  await expect(textArea(page)).toBeFocused();
  const canvas = await canvasBox(page);
  const area = await textArea(page).boundingBox();
  expect(area).not.toBeNull();
  expect(Math.abs((area?.x ?? 0) - canvas.x - x)).toBeLessThanOrEqual(0.5);
  expect(area?.height).toBeCloseTo(25, 1);
  expect(Math.abs((area?.y ?? 0) + (area?.height ?? 0) / 2 - canvas.y - y)).toBeLessThanOrEqual(
    0.5,
  );
}

/** The box and mean point of the dark pixels in a square, in CSS pixels relative to the scene canvas. */
export interface Ink {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Decodes a PNG screenshot in the page and measures its dark pixels, whose channels are all below
 * 128: the drawn text or the text area's glyphs, never the blue selection chrome or outline.
 */
const INK_OF = (png: string, origin: readonly [number, number]) => `(async () => {
  const image = new Image();
  image.src = 'data:image/png;base64,${png}';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, image.width, image.height);
  const ink = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, x: 0, y: 0 };
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (Math.max(data[index], data[index + 1], data[index + 2]) >= 128) continue;
    const x = ((index / 4) % image.width) + 0.5;
    const y = Math.floor(index / 4 / image.width) + 0.5;
    ink.left = Math.min(ink.left, x - 0.5);
    ink.top = Math.min(ink.top, y - 0.5);
    ink.right = Math.max(ink.right, x + 0.5);
    ink.bottom = Math.max(ink.bottom, y + 0.5);
    ink.x += x;
    ink.y += y;
    count += 1;
  }
  if (count === 0) return null;
  const [dx, dy] = ${JSON.stringify(origin)};
  return {
    left: ink.left + dx,
    top: ink.top + dy,
    right: ink.right + dx,
    bottom: ink.bottom + dy,
    x: ink.x / count + dx,
    y: ink.y / count + dy,
  };
})()`;

/**
 * The ink that the page shows in a square around a canvas point, scene and text area alike, from a
 * screenshot in CSS pixels with the caret hidden; in canvas coordinates. The text area's hint chip
 * (the v0.2 plan's S9), whose words lie under the text area, is masked in white, so that only the
 * text's own glyphs count.
 */
export async function inkAround(page: Page, [x, y]: readonly [number, number], half: number) {
  const box = await canvasBox(page);
  const clip = { x: box.x + x - half, y: box.y + y - half, width: 2 * half, height: 2 * half };
  const png = await page.screenshot({
    clip,
    scale: 'css',
    caret: 'hide',
    animations: 'disabled',
    mask: [page.locator('#text-editor-hint')],
    maskColor: '#ffffff',
  });
  const ink = await page.evaluate<Ink | null>(INK_OF(png.toString('base64'), [x - half, y - half]));
  if (ink === null) throw new Error(`No ink around (${String(x)}, ${String(y)}).`);
  return ink;
}
