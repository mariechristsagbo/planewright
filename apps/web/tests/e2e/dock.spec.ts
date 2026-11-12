import { expect, test } from '@playwright/test';

import { elementList, elementsToggle, openElements, openPage } from './a11y.ts';
import { toolButton, touch } from './drawing.ts';
import { islands } from './layout.ts';
import { textArea } from './text.ts';
import { readout } from './support.ts';

// The tool bar as the phone's dock (ADR 0012, decisions 2 and 14; the v0.2 plan's S8, issue #73's
// A2, A5, A6 and A8): on a phone in portrait the toolbar "Tools" sits 8 px above the window's
// bottom, its seven 44 px buttons in one row, history and zoom 8 px above it, the top bar holds
// identity and Elements alone, the bottom-right island is not shown, the view readout keeps its
// text unseen, the page never scrolls, and the Text tool works as before. Page code is written as
// strings, since these files compile without the DOM library.

/** The tool bar's buttons' boxes, as [x, y, width, height]. */
const BUTTONS = `[...document.querySelector('[role="toolbar"][aria-label="Tools"]').querySelectorAll('button')]
  .map((button) => { const { x, y, width, height } = button.getBoundingClientRect(); return [x, y, width, height]; })`;

/** The document's and the body's scroll sizes, and where the window is after scrolling to 100. */
const SCROLL = `(() => {
  window.scrollTo(0, 100);
  document.body.scrollTop = 100;
  const { documentElement: html, body } = document;
  return [html.scrollWidth, html.scrollHeight, body.scrollWidth, body.scrollHeight, window.scrollY, body.scrollTop];
})()`;

for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 360, height: 560 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('A2 D2 the tool bar is a dock 8 px above the window’s bottom, its seven buttons in one row, each at least 44 by 44 px', async ({
      page,
    }) => {
      await openPage(page);
      const toolbar = page.getByRole('toolbar', { name: 'Tools' });
      await expect(toolbar.getByRole('button')).toHaveCount(7);
      const dock = (await islands(page)).find(({ name }) => name === 'tools');
      if (dock === undefined) throw new Error('No tools island.');
      expect([dock.x, viewport.height - dock.y - dock.height, dock.width]).toEqual([
        8,
        8,
        viewport.width - 16,
      ]);
      const buttons = await page.evaluate<number[][]>(BUTTONS);
      expect(buttons).toHaveLength(7);
      expect(new Set(buttons.map(([, y]) => y)).size).toBe(1);
      expect(buttons.filter(([, , width = 0, height = 0]) => width < 44 || height < 44)).toEqual(
        [],
      );
    });

    test('A5 A6 D4 D5 at rest the top bar holds identity and Elements alone, history and zoom end 8 px above the dock, and the bottom-right island is not shown', async ({
      page,
    }) => {
      await openPage(page);
      const boxes = await islands(page);
      expect(boxes.filter(({ y }) => y < 100).map(({ name }) => name)).toEqual([
        'identity',
        'top-right',
      ]);
      const topRight = page.locator('[data-island="top-right"]');
      await expect(topRight.getByRole('button')).toHaveCount(1);
      await expect(topRight.getByRole('button')).toHaveAccessibleName(/^Elements/u);
      const history = boxes.find(({ name }) => name === 'bottom-left');
      const dock = boxes.find(({ name }) => name === 'tools');
      if (history === undefined || dock === undefined) throw new Error('No bottom islands.');
      expect(dock.y - history.y - history.height).toBe(8);
      expect(boxes.map(({ name }) => name)).not.toContain('bottom-right');
      await expect(page.locator('[data-island="bottom-right"]')).toBeHidden();
    });

    test('A8 D7 the view readout is not visible, yet keeps its text', async ({ page }) => {
      await openPage(page);
      await expect(readout(page)).toBeHidden();
      await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
    });

    test('A11 the page does not scroll', async ({ page }) => {
      await openPage(page);
      const { width, height } = viewport;
      expect(await page.evaluate(SCROLL)).toEqual([width, height, width, height, 0, 0]);
    });
  });
}

test.describe('at 390 × 844 with touch, the Text tool', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('a tap and typing still write a text with the dock present (S9 changes nothing here)', async ({
    page,
  }) => {
    await openPage(page);
    await expect(async () => {
      await toolButton(page, 'Text').tap();
      await expect(toolButton(page, 'Text')).toHaveAttribute('aria-pressed', 'true', {
        timeout: 1000,
      });
    }).toPass();
    await expect(async () => {
      await touch(page, [60, 300]);
      await expect(textArea(page)).toBeFocused({ timeout: 1000 });
    }).toPass();
    await page.keyboard.type('Dock');
    await expect(textArea(page)).toHaveValue('Dock');
    await touch(page, [250, 450]);
    await expect(textArea(page)).toHaveCount(0);
    await openElements(page);
    await expect(elementList(page).getByRole('option')).toHaveCount(1);
    await expect(elementList(page).getByRole('option')).toHaveAccessibleName(/^Text/u);
    await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'true');
  });
});
