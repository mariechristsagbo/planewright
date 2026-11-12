import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import type { Point } from './drawing.ts';
import { settled } from './motion.ts';
import { FIXTURE_CAMERA } from './scene-fixture.ts';

// What every visual baseline checks before its capture (ADR 0012, decision 17; the v0.2 plan's
// S13): the same context pins, the faces that the shown text uses loaded, the scene drawn, every
// entrance ended, no tooltip and, with a mouse, the pointer resting where nothing reacts to it, so
// that an image records the state and never a moment on the way to it. Page code is written as
// strings, since these files compile without the DOM library.

/** Every visual test's context: the light scheme, one locale and one time zone. */
export const VISUAL_CONTEXT = {
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: 'UTC',
} as const;

/** Where the mouse rests before a capture: a point of the canvas that nothing covers at 1440 × 900. */
export const PARK: Point = [1100, 760];

/** A scene point as a canvas point under the fixture's camera. */
export const onScreen = ([x, y]: Point): Point => [
  (x - FIXTURE_CAMERA.x) * FIXTURE_CAMERA.zoom,
  (y - FIXTURE_CAMERA.y) * FIXTURE_CAMERA.zoom,
];

/** A point of the fixture's first rectangle, blue and filled, that no other element covers. */
export const RECTANGLE = onScreen([48, 115]);

/** A point of the fixture's unrotated "sans again" text, the topmost element there. */
export const SANS_AGAIN = onScreen([85, 142]);

/** Whether the canvas host matches :focus-visible, which shows its ring and chip (S10). */
export const canvasFocusVisible = (page: Page): Promise<boolean> =>
  page.evaluate<boolean>(
    `document.querySelector('[aria-label="Drawing canvas"]').matches(':focus-visible')`,
  );

/** The empty-canvas note, by the start of its sentence. */
export const emptyNote = (page: Page): Locator =>
  page.getByText(/^Pre-release — you can draw shapes, lines, freehand strokes and texts/u);

/** What a capture shows: with a mouse or by touch, and the seeded fixture or not. */
export interface Capture {
  readonly touch: boolean;
  readonly fixture: boolean;
}

/** The canvas faces of the fixture's texts, as family and weight. */
const CANVAS_FACES = ['Planewright Sans|400', 'Planewright Hand|400', 'Planewright Mono|400'];

/**
 * Page code that waits for the page's fonts, then names each face that the visible text uses, and
 * each of `required`, that is not loaded: by the first family of the text's font, and the face of
 * that family whose weight the browser picks for it. A family that no bundled face has is named too,
 * since its text would show a fallback.
 */
const UNLOADED_FACES = (required: readonly string[]) => `(async () => {
  await document.fonts.ready;
  const clean = (family) => family.trim().replaceAll(/["']/g, '');
  const faces = [...document.fonts];
  const up = (a, b) => a - b;
  const down = (a, b) => b - a;
  const pick = (family, weight) => {
    const own = faces.filter((face) => clean(face.family) === family);
    const weights = own.map((face) => Number(face.weight));
    const order = weight >= 400 && weight <= 500
      ? [...weights.filter((w) => w >= weight && w <= 500).sort(up), ...weights.filter((w) => w < weight).sort(down), ...weights.filter((w) => w > 500).sort(up)]
      : weight < 400
        ? [...weights.filter((w) => w <= weight).sort(down), ...weights.filter((w) => w > weight).sort(up)]
        : [...weights.filter((w) => w >= weight).sort(up), ...weights.filter((w) => w < weight).sort(down)];
    return own.find((face) => Number(face.weight) === order[0]);
  };
  const used = new Set(${JSON.stringify(required)});
  for (const element of document.querySelectorAll('body *')) {
    const text = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
    if (!(text || element.localName === 'textarea')) continue;
    if (!element.checkVisibility({ visibilityProperty: true })) continue;
    const style = getComputedStyle(element);
    used.add(clean(style.fontFamily.split(',')[0]) + '|' + style.fontWeight);
  }
  return [...used].sort().flatMap((key) => {
    const [family, weight] = key.split('|');
    const face = pick(family, Number(weight));
    return face?.status === 'loaded' ? [] : [family + ' ' + weight + ' ' + (face?.status ?? 'has no bundled face')];
  });
})()`;

/** What lies under the parked mouse: the canvas, a modal dialog's backdrop, or another element. */
const UNDER_PARK = `(() => {
  const element = document.elementFromPoint(${PARK.join(', ')});
  if (element?.closest('[aria-label="Drawing canvas"]') != null) return 'free';
  if (element?.localName === 'dialog' && element.matches(':modal')) return 'free';
  return element === null ? 'nothing' : element.outerHTML.slice(0, 80);
})()`;

const TWO_FRAMES =
  'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))';

/**
 * Makes the page ready for its capture, failing with what is wrong: the mouse parked, where there
 * is one; every face that the shown text uses loaded, within 10 s; a scene render, where the
 * fixture shows, then two animation frames; no animation running; and no tooltip shown.
 */
export async function ready(page: Page, { touch, fixture }: Capture): Promise<void> {
  if (!touch) {
    await page.mouse.move(...PARK);
    expect(await page.evaluate<string>(UNDER_PARK), 'what the parked mouse rests on').toBe('free');
  }
  const required = fixture ? CANVAS_FACES : [];
  await expect
    .poll(() => page.evaluate<string[]>(UNLOADED_FACES(required)), {
      message: 'every face that the shown text uses is loaded',
      timeout: 10_000,
    })
    .toEqual([]);
  if (fixture) {
    await page.waitForFunction(
      `performance.getEntriesByName('planewright:render-scene').some((entry) => entry.detail.elements > 0)`,
    );
  }
  await page.evaluate(TWO_FRAMES);
  await settled(page);
  const tip = page.locator('#chrome-tip');
  if (await tip.isVisible()) {
    throw new Error(`A tooltip shows before the capture: "${(await tip.textContent()) ?? ''}".`);
  }
}
