import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { settled } from './motion.ts';

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
 * drawer's and the open Details sheet's while they show; hidden notices are left out, as the
 * closed drawer is (the v0.2 plan's S7), and so is an island with no area, as the bottom-right
 * island is on a phone in portrait (S8).
 */
const ISLANDS = `[...document.querySelectorAll('[data-island], [aria-label="Storage notices"]:not([hidden]), #element-list-drawer:not([hidden]), #details-sheet:not([hidden])')]
  .filter((element) => { const { width, height } = element.getBoundingClientRect(); return width > 0 && height > 0; })
  .map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { name: element.dataset.island ?? (element.id || element.getAttribute('aria-label')), x, y, width, height };
  })`;

/** The islands' boxes, once every entrance has ended (ADR 0012, D2). */
export async function islands(page: Page): Promise<Box[]> {
  await settled(page);
  return page.evaluate<Box[]>(ISLANDS);
}

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
 * Whether the phone's dock shows, a phone in portrait, SHEET_QUERY in shell/sheet.ts, and the
 * bottom safe-area inset that the shell reads, or that a test emulates (S8).
 */
const BOTTOM = `({
  dock: matchMedia('(max-width: 599px) and (min-height: 500px)').matches,
  inset: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shell-safe-bottom')) || 0,
})`;

/**
 * Every island, and the notices and the drawer while they show, inside the viewport and apart, with
 * history and zoom no more than the largest anchor, 16 px, above the dock's top while the phone's
 * dock shows, and above the window's bottom less its safe-area inset otherwise. On a phone in portrait the open drawer, and
 * the Details sheet, are sheets over the dock and the bottom islands, which may meet them, in
 * either order, only while their controls are inert (S5, S6, S8). While a phone in portrait edits a
 * text, history and zoom and the dock are hidden, so history and zoom are measured only while they
 * are laid out, and the Done bar is an island like the others (S9).
 */
export async function expectPlaced(page: Page, viewport: Viewport, count: number): Promise<void> {
  const boxes = await islands(page);
  expect(boxes).toHaveLength(count);
  const inert = await page.evaluate<string[]>(INERT);
  const sheets = new Set(['element-list-drawer', 'details-sheet']);
  const covered = (pair: string): boolean => {
    const [a = '', b = ''] = pair.split(' × ');
    return (sheets.has(a) && inert.includes(b)) || (sheets.has(b) && inert.includes(a));
  };
  expect({
    outside: outside(boxes, viewport),
    intersecting: intersecting(boxes).filter((pair) => !covered(pair)),
  }).toEqual({ outside: [], intersecting: [] });
  const history = boxes.find(({ name }) => name === 'bottom-left');
  if (history === undefined) return;
  const dock = boxes.find(({ name }) => name === 'tools');
  const bottom = await page.evaluate<{ dock: boolean; inset: number }>(BOTTOM);
  // Under the dock's query, history and zoom are laid out only with the dock under them.
  const floor = bottom.dock ? dock?.y : viewport.height - bottom.inset;
  expect(floor, 'the dock under history and zoom').toBeDefined();
  expect((floor ?? 0) - history.y - history.height).toBeLessThanOrEqual(16);
}
