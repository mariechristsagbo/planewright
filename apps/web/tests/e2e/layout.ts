import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Where the shell's islands lie (ADR 0012, decision 13): every island, the selection panel or bar,
// the shown notices, the open drawer and the open Details sheet inside the window and apart, for
// the end-to-end layout tests. Page code is written as strings, since these files compile without
// the DOM library.

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface Box {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Each island's box, the selection panel's or bar's among them, and the notices', the open
 * drawer's and the open Details sheet's while they show.
 */
const ISLANDS = `[...document.querySelectorAll('[data-island], [aria-label="Storage notices"], #element-list-drawer:not([hidden]), #details-sheet:not([hidden])')]
  .map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { name: element.dataset.island ?? (element.id || element.getAttribute('aria-label')), x, y, width, height };
  })`;

export const islands = (page: Page): Promise<Box[]> => page.evaluate<Box[]>(ISLANDS);

/** The pairs of boxes that share any area. */
export function intersecting(boxes: readonly Box[]): string[] {
  return boxes.flatMap((a, index) =>
    boxes
      .slice(index + 1)
      .filter(
        (b) =>
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height,
      )
      .map((b) => `${a.name} × ${b.name}`),
  );
}

/** The boxes that reach outside the viewport, by name. */
export const outside = (boxes: readonly Box[], { width, height }: Viewport): string[] =>
  boxes
    .filter(
      (box) => box.x < 0 || box.y < 0 || box.x + box.width > width || box.y + box.height > height,
    )
    .map(({ name }) => name);

/** The islands whose controls are inert, which the phone's sheet covers (the v0.2 plan's S5). */
export const INERT = `[...document.querySelectorAll('[inert]')].map((element) => element.closest('[data-island]').dataset.island)`;

/**
 * Every island, and the notices and the drawer while they show, inside the viewport and apart, with
 * history and zoom at the window's bottom, no more than the largest anchor, 16 px, above its edge.
 * On a phone in portrait the open drawer, and the Details sheet, are sheets over the bottom islands,
 * which may meet them only while their controls are inert (S5, S6).
 */
export async function expectPlaced(page: Page, viewport: Viewport, count: number): Promise<void> {
  const boxes = await islands(page);
  expect(boxes).toHaveLength(count);
  const inert = await page.evaluate<string[]>(INERT);
  const covered = (pair: string): boolean =>
    /^(element-list-drawer|details-sheet) × /u.test(pair) &&
    inert.includes(pair.split(' × ')[1] ?? '');
  expect({
    outside: outside(boxes, viewport),
    intersecting: intersecting(boxes).filter((pair) => !covered(pair)),
  }).toEqual({ outside: [], intersecting: [] });
  const history = boxes.find(({ name }) => name === 'bottom-left');
  expect(viewport.height - (history?.y ?? 0) - (history?.height ?? 0)).toBeLessThanOrEqual(16);
}
