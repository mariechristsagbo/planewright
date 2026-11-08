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
