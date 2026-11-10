import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { openElements, openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { refuseStorage, storageNotices } from './storage.ts';
import { canvas, canvasBox, expectHistoryDisabled, readout } from './support.ts';

// The full-bleed shell (ADR 0012, decision 13, issue #55's A2 to A4 and A10): the canvas host fills
// the viewport and keeps its 1 px border, made transparent, neither html nor body scrolls, the
// islands sit at their anchors without intersecting, and a press on an island never reaches the
// canvas. Page code is written as strings, since these files compile without the DOM library.

interface Box {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Each island's box, and the notices' and the open drawer's while they show. */
const ISLANDS = `[...document.querySelectorAll('[data-island], [aria-label="Storage notices"], #elements-drawer:not([hidden])')]
  .map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { name: element.dataset.island ?? (element.id || element.getAttribute('aria-label')), x, y, width, height };
  })`;

const islands = (page: Page): Promise<Box[]> => page.evaluate<Box[]>(ISLANDS);

/** The pairs of boxes that share any area. */
function intersecting(boxes: readonly Box[]): string[] {
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

/** The document's and the body's scroll sizes, and where the window is after scrolling to 100. */
const SCROLL = `(() => {
  window.scrollTo(0, 100);
  document.body.scrollTop = 100;
  const { documentElement: html, body } = document;
  return {
    html: [html.scrollWidth, html.scrollHeight],
    body: [body.scrollWidth, body.scrollHeight],
    scrolled: [window.scrollX, window.scrollY, body.scrollTop],
  };
})()`;

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('A2 the canvas host fills the viewport, and the scene canvas sits inside its 1 px border', async ({
      page,
    }) => {
      await openPage(page);
      const { width, height } = viewport;
      expect(await canvas(page).boundingBox()).toEqual({ x: 0, y: 0, width, height });
      expect(await canvasBox(page)).toEqual({ x: 1, y: 1, width: width - 2, height: height - 2 });
      const border = await page.evaluate(
        "(() => { const style = getComputedStyle(document.getElementById('drawing-canvas')); return [style.borderTopWidth, style.borderTopColor]; })()",
      );
      expect(border).toEqual(['1px', 'rgba(0, 0, 0, 0)']);
    });

    test('A3 neither html nor body scrolls', async ({ page }) => {
      await openPage(page);
      const size = [viewport.width, viewport.height];
      expect(await page.evaluate(SCROLL)).toEqual({ html: size, body: size, scrolled: [0, 0, 0] });
    });

    test('A4 no two islands intersect, at rest and with the drawer open under a storage notice', async ({
      page,
    }) => {
      await openPage(page);
      const rest = await islands(page);
      expect(rest.map(({ name }) => name)).toEqual([
        'identity',
        'tools',
        'top-right',
        'bottom-left',
        'bottom-right',
      ]);
      expect(intersecting(rest)).toEqual([]);
      await refuseStorage(page);
      await openPage(page);
      await expect(storageNotices(page)).toBeVisible();
      await openElements(page);
      const open = await islands(page);
      expect(open).toHaveLength(7);
      expect(intersecting(open)).toEqual([]);
    });
  });
}

test('A10 REQ-C11 a press or a drag on an island, with a creation tool active, creates nothing and starts no gesture', async ({
  page,
}) => {
  await openPage(page);
  await toolButton(page, 'Rectangle').click();
  await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'true');
  // Points in each island's padding, clear of its controls and of its rounded corners: the middle
  // of its left edge for a press, and of its bottom edge for a drag onto the canvas.
  const presses = await page.evaluate<number[][]>(`[...document.querySelectorAll('[data-island]')]
    .map((island) => { const box = island.getBoundingClientRect(); return [box.x + 2, box.y + box.height / 2, box.x + box.width / 2, box.y + box.height - 2]; })`);
  expect(presses).toHaveLength(5);
  for (const [x = 0, y = 0, middle = 0, bottom = 0] of presses) {
    await page.mouse.click(x, y);
    await page.mouse.move(middle, bottom);
    await page.mouse.down();
    await page.mouse.move(640, 360, { steps: 6 });
    await page.mouse.up();
  }
  await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
  await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'true');
  await expect(polite(page)).toHaveText('');
  await expectHistoryDisabled(page);
  await expect((await openElements(page)).getByRole('option')).toHaveCount(0);
});
