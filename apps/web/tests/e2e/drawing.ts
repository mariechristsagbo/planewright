import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { canvasBox } from './support.ts';

// What the drawing tests read from the page (ENG-11): the canvas pixels under a point, through the
// layers' backing stores, and touch input through the Chrome DevTools Protocol. Points are in CSS
// pixels relative to the scene canvas, where the editor's screen space starts.

export type Point = readonly [x: number, y: number];

/** The RGBA of one layer's device pixel under a canvas point: layer 0 is the scene, 1 the overlay. */
const PIXEL = (layer: number, [x, y]: Point) => `(() => {
  const canvas = document.querySelectorAll('[aria-label="Drawing canvas"] canvas')[${String(layer)}];
  const ratio = canvas.width / canvas.getBoundingClientRect().width;
  const at = [Math.floor(${String(x)} * ratio), Math.floor(${String(y)} * ratio)];
  return Array.from(canvas.getContext('2d').getImageData(at[0], at[1], 1, 1).data);
})()`;

/** Counts the overlay's device pixels that are not transparent. */
const OVERLAY_INK = `(() => {
  const layer = document.querySelectorAll('[aria-label="Drawing canvas"] canvas')[1];
  const { data } = layer.getContext('2d').getImageData(0, 0, layer.width, layer.height);
  let ink = 0;
  for (let alpha = 3; alpha < data.length; alpha += 4) if (data[alpha] !== 0) ink += 1;
  return ink;
})()`;

const pixel = (page: Page, layer: number, at: Point): Promise<number[]> =>
  page.evaluate<number[]>(PIXEL(layer, at));

/** Whether the scene shows a stroke under a point: darker than the white canvas. */
export const inked = async (page: Page, at: Point): Promise<boolean> =>
  ((await pixel(page, 0, at))[0] ?? 255) < 128;

/** Whether the overlay draws selection chrome, such as a handle, under a point. */
export const chrome = async (page: Page, at: Point): Promise<boolean> =>
  ((await pixel(page, 1, at))[3] ?? 0) > 0;

/** The scene's colour under a point, as [r, g, b]. */
export const colourAt = async (page: Page, at: Point): Promise<number[]> =>
  (await pixel(page, 0, at)).slice(0, 3);

export const overlayInk = async (page: Page): Promise<number> =>
  Number(await page.evaluate(OVERLAY_INK));

/** Waits until each point is inked on the scene, or blank where `false`. */
export async function expectInk(page: Page, points: readonly Point[], ink = true): Promise<void> {
  for (const at of points) await expect.poll(() => inked(page, at)).toBe(ink);
}

/**
 * Waits until the overlay draws chrome at exactly the `on` points among the probes: each probe is
 * a handle position that only one selection has.
 */
export async function expectChrome(
  page: Page,
  probes: Readonly<Record<string, Point>>,
  on: readonly string[],
): Promise<void> {
  const shown = async () => {
    const names = Object.keys(probes);
    const hits = await Promise.all(names.map((name) => chrome(page, probes[name] ?? [0, 0])));
    return names.filter((_, index) => hits[index]);
  };
  await expect.poll(shown).toEqual([...on]);
  if (on.length === 0) await expect.poll(() => overlayInk(page)).toBe(0);
}

/** A mouse drag between canvas points, through enough moves to pass the drag threshold. */
export async function mouseDrag(page: Page, from: Point, to: Point): Promise<void> {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 8 });
  await page.mouse.up();
}

/** A mouse click at a canvas point, with Shift held if asked. */
export async function mouseClick(page: Page, at: Point, shift = false): Promise<void> {
  const box = await canvasBox(page);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.click(box.x + at[0], box.y + at[1]);
  if (shift) await page.keyboard.up('Shift');
}

/** The DevTools modifier bit for Shift. */
const SHIFT = 8;

/** One finger's touch from one canvas point to another in steps, or a tap when they are equal. */
export async function touch(page: Page, from: Point, to: Point = from, shift = false) {
  const box = await canvasBox(page);
  const client = await page.context().newCDPSession(page);
  const modifiers = shift ? SHIFT : 0;
  const point = ([x, y]: Point) => [{ x: box.x + x, y: box.y + y, id: 0 }];
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(from),
    modifiers,
  });
  const steps = from[0] === to[0] && from[1] === to[1] ? 0 : 8;
  for (let step = 1; step <= steps; step += 1) {
    const at: Point = [
      from[0] + ((to[0] - from[0]) * step) / steps,
      from[1] + ((to[1] - from[1]) * step) / steps,
    ];
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(at),
      modifiers,
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], modifiers });
  await client.detach();
}

/** The tool bar button of a tool or of tool lock, found by its exact name. */
export const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name, exact: true });
