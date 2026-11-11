import { expect, test } from '@playwright/test';

import { button, elementsToggle, openElements, openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { INERT, expectPlaced, intersecting, islands } from './layout.ts';
import { refuseStorage, showStaleNotice, storageNotices } from './storage.ts';
import { canvas, canvasBox, expectHistoryDisabled, readout } from './support.ts';

// The full-bleed shell (ADR 0012, decision 13, issue #55's A2 to A4 and A10): the canvas host fills
// the viewport and keeps its 1 px border, made transparent, neither html nor body scrolls, the
// islands sit at their anchors inside the window without intersecting, and a press on an island
// never reaches the canvas. Page code is written as strings, since these files compile without the
// DOM library.

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

    test('A4 no two islands intersect and each lies inside the window, at rest and with the drawer open under a storage notice', async ({
      page,
    }) => {
      await openPage(page);
      expect((await islands(page)).map(({ name }) => name)).toEqual([
        'identity',
        'tools',
        'top-right',
        'bottom-left',
        'bottom-right',
      ]);
      await expectPlaced(page, viewport, 5);
      await refuseStorage(page);
      await openPage(page);
      await expect(storageNotices(page)).toBeVisible();
      await openElements(page);
      await expectPlaced(page, viewport, 7);
      // The phone's sheet covers the bottom islands, whose controls it makes inert (S5).
      const met = intersecting(await islands(page));
      expect([met, await page.evaluate<string[]>(INERT)]).toEqual(
        viewport.width < 600
          ? [
              ['element-list-drawer × bottom-left', 'element-list-drawer × bottom-right'],
              ['tools', 'bottom-left', 'bottom-right'],
            ]
          : [[], []],
      );
    });
  });
}

// With a selection (issue #69's A9): the selection panel lies inside the window, apart from every
// island, the stale notice and the open drawer, beside the notice and the drawer at the left.
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 800, height: 720 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with a selection`, () => {
    test.use({ viewport });

    test('A9 the selection panel, the islands, the stale notice and the drawer lie inside the window and apart', async ({
      page,
    }) => {
      await openPage(page);
      await showStaleNotice(page);
      await expectPlaced(page, viewport, 7);
      expect((await islands(page)).map(({ name }) => name)).toContain('selection');
      await openElements(page);
      await expectPlaced(page, viewport, 8);
    });
  });
}

// Short windows while storage needs attention (the S2 review's M1): the notices and the open drawer
// share the height that the top and bottom islands leave, each scrolling within its share, so that
// every island stays inside the window, apart from the others.
for (const viewport of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('A4 M1 every island lies inside the window, apart, under the stale notice with the drawer closed and open', async ({
      page,
    }) => {
      await openPage(page);
      await showStaleNotice(page);
      // The nudged rectangle stays selected, so the selection panel is one more box (S6).
      await expectPlaced(page, viewport, 7);
      await openElements(page);
      await expectPlaced(page, viewport, 8);
    });

    test('A4 M1 every island lies inside the window, apart, under the storage-unavailable notice with the drawer closed and open', async ({
      page,
    }) => {
      await refuseStorage(page);
      await openPage(page);
      await expect(storageNotices(page)).toBeVisible();
      await expectPlaced(page, viewport, 6);
      await openElements(page);
      await expectPlaced(page, viewport, 7);
    });
  });
}

test.describe('at 844 × 140, barely taller than the top and bottom islands', () => {
  const viewport = { width: 844, height: 140 };
  test.use({ viewport });

  test('A4 M1 the notices and the open drawer shrink rather than cover the bottom islands', async ({
    page,
  }) => {
    await openPage(page);
    await showStaleNotice(page);
    await openElements(page);
    // The selection panel shows for the nudged rectangle, scrolling in the room it has (S6).
    await expectPlaced(page, viewport, 8);
  });
});

test.describe('at 390 × 844 with the Details sheet', () => {
  const viewport = { width: 390, height: 844 };
  test.use({ viewport, isMobile: true, hasTouch: true });

  test('A9 the selection bar, the stale notice and the Details sheet lie inside the window, apart from every island but the inert ones under the sheet', async ({
    page,
  }) => {
    await openPage(page);
    await showStaleNotice(page);
    await page.locator('[data-island="selection"]').getByRole('button', { name: 'Details' }).tap();
    await expect(page.getByRole('region', { name: 'Details' })).toBeVisible();
    await expectPlaced(page, viewport, 8);
    expect(intersecting(await islands(page))).toEqual([
      'details-sheet × bottom-left',
      'details-sheet × bottom-right',
    ]);
  });
});

/** How far the shell has scrolled, and where the canvas host's top is. */
const SHELL = `(() => ({
  shell: document.querySelector('.editor-shell').scrollTop,
  canvas: document.getElementById('drawing-canvas').getBoundingClientRect().y,
}))()`;

test.describe('at 667 × 375', () => {
  test.use({ viewport: { width: 667, height: 375 } });

  test('M1 Tab past the stale notice to Undo shows each stop in the window and never scrolls the shell', async ({
    page,
  }) => {
    await openPage(page);
    await showStaleNotice(page);
    await canvas(page).focus();
    const notices = storageNotices(page);
    const panel = page.locator('[data-island="selection"]');
    // The selected rectangle's panel comes first (S6).
    for (const stop of [
      panel.getByRole('button', { name: 'Duplicate' }),
      panel.getByRole('button', { name: 'Delete' }),
      notices.getByRole('button', { name: 'Load the newer version' }),
      notices.getByRole('button', { name: 'Keep this version' }),
      elementsToggle(page),
      button(page, 'Undo'),
    ]) {
      await page.keyboard.press('Tab');
      await expect(stop).toBeFocused();
      await expect(stop).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(SHELL)).toEqual({ shell: 0, canvas: 0 });
    }
  });
});

test.describe('at 568 × 200, shorter than the islands need', () => {
  test.use({ viewport: { width: 568, height: 200 } });

  test('M1 Tab to Undo never scrolls the shell, so the canvas stays under the whole window', async ({
    page,
  }) => {
    await openPage(page);
    await canvas(page).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(button(page, 'Undo')).toBeFocused();
    expect(await page.evaluate(SHELL)).toEqual({ shell: 0, canvas: 0 });
  });
});

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
