import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// What the end-to-end tests read and drive: the view readout, the canvas host and its scene canvas.

export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export const readout = (page: Page): Locator => page.locator('#view-readout');
export const canvas = (page: Page): Locator => page.getByRole('region', { name: 'Drawing canvas' });

/** The camera that the view readout shows, to one decimal place and the zoom in per cent. */
export async function cameraOf(page: Page): Promise<Camera> {
  const text = (await readout(page).textContent()) ?? '';
  const match = /^View: x (-?[\d.]+), y (-?[\d.]+), zoom ([\d.]+)%$/u.exec(text);
  if (match === null) throw new Error(`The view readout says "${text}".`);
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) / 100 };
}

/** The scene canvas, inside the canvas host's border: editor points are relative to it. */
export const sceneCanvas = (page: Page): Locator => canvas(page).locator('canvas').first();

/** The scene canvas's box in page pixels, inside the host's border; it must be laid out. */
export async function canvasBox(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await sceneCanvas(page).boundingBox();
  if (box === null) throw new Error('The scene canvas is not laid out.');
  return box;
}

/** Waits for the readout to show a camera within 0.06 scene units and 0.06 % of the expected one. */
export async function expectCamera(page: Page, expected: Camera): Promise<void> {
  await expect
    .poll(async () => {
      const camera = await cameraOf(page);
      return (
        Math.abs(camera.x - expected.x) <= 0.06 &&
        Math.abs(camera.y - expected.y) <= 0.06 &&
        Math.abs(camera.zoom - expected.zoom) <= 0.0006
      );
    })
    .toBe(true);
}

/** Undo and Redo are disabled (REQ-V10, REQ-H04). */
export async function expectHistoryDisabled(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
}
