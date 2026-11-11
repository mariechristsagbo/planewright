import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { button, elementList, elementsToggle, openPage, polite } from './a11y.ts';
import { boxOf, drawText, onCanvas, panelButton, selectionSurface } from './panel.ts';
import { expectSaved, showStaleNotice, storageNotices } from './storage.ts';
import { canvas } from './support.ts';

// The phone's selection bar and Details sheet (ADR 0012, decisions 2, 13 and 14; the v0.2 plan's S6,
// issue #69's D3 and D4): on a phone in portrait the bar shows in the panel's place, under the top
// rows and above the notices, every target 44 px; Details opens a sheet along the bottom with the
// covered islands inert, which Escape and Close close, which never shares the screen with the
// Elements sheet, and which goes with the selection. Page code is written as strings, since these
// files compile without the DOM library.

/** The islands whose controls are inert, by name. */
const INERT = `[...document.querySelectorAll('[inert]')].map((element) => element.closest('[data-island]').dataset.island)`;

/** The Details sheet, while it is open. */
const detailsSheet = (page: Page) => page.getByRole('region', { name: 'Details' });

/** A tap at the middle of a control, as a finger gives it. */
async function tap(page: Page, name: string): Promise<void> {
  await panelButton(page, name).tap();
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 360, height: 560 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('D3 A6 the bar sits under the top rows and above the stale notice, apart from every island, every target at least 44 px', async ({
      page,
    }) => {
      await openPage(page);
      await showStaleNotice(page);
      const bar = await boxOf(selectionSurface(page));
      const tools = await boxOf(page.locator('[data-island="tools"]'));
      const notices = await boxOf(storageNotices(page));
      expect(bar.y).toBeGreaterThanOrEqual(tools.y + tools.height);
      expect(notices.y).toBeGreaterThanOrEqual(bar.y + bar.height);
      expect([bar.x, bar.width]).toEqual([8, viewport.width - 16]);
      // The bar comes before the notices in the document's order too.
      expect(
        await page.evaluate<boolean>(
          '!!(document.querySelector(\'[data-island="selection"]\').compareDocumentPosition(document.querySelector(\'[aria-label="Storage notices"]\')) & Node.DOCUMENT_POSITION_FOLLOWING)',
        ),
      ).toBe(true);
      const names = ['Duplicate', 'Delete', 'Details'];
      for (const name of names) {
        const target = await boxOf(panelButton(page, name));
        expect(Math.min(target.width, target.height), name).toBeGreaterThanOrEqual(44);
      }
      await expect(selectionSurface(page).getByRole('button')).toHaveCount(names.length);
    });

    test('D3 the bar’s actions take the panel’s tab stops, and the Elements sheet, its list full, opens below the bar', async ({
      page,
    }) => {
      await openPage(page);
      await canvas(page).focus();
      for (let made = 0; made < 40; made += 1) {
        await page.keyboard.press('r');
        await page.keyboard.press('Enter');
      }
      await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
      for (const stop of [
        panelButton(page, 'Duplicate'),
        panelButton(page, 'Delete'),
        panelButton(page, 'Details'),
        elementsToggle(page),
      ]) {
        await page.keyboard.press('Tab');
        await expect(stop).toBeFocused();
      }
      await page.keyboard.press('Enter');
      await expect(elementList(page)).toBeFocused();
      await expect(elementList(page).getByRole('option')).toHaveCount(40);
      const bar = await boxOf(selectionSurface(page));
      const sheet = await boxOf(page.locator('#element-list-drawer'));
      expect(sheet.y).toBeGreaterThanOrEqual(bar.y + bar.height);
      // Nothing lies over the bar's middle.
      const topmost = await page.evaluate<boolean>(`(() => {
        const bar = document.querySelector('[data-island="selection"]');
        const { x, y, width, height } = bar.getBoundingClientRect();
        return bar.contains(document.elementFromPoint(x + width / 2, y + height / 2));
      })()`);
      expect(topmost).toBe(true);
    });

    test('D4 A7 Details opens the sheet on Close Details with the covered islands inert, and Escape and Close give the focus back to Details, the selection kept', async ({
      page,
    }) => {
      await openPage(page);
      await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
      await tap(page, 'Details');
      await expect(panelButton(page, 'Details')).toHaveAttribute('aria-expanded', 'true');
      await expect(button(page, 'Close Details')).toBeFocused();
      expect(await page.evaluate<string[]>(INERT)).toEqual([
        'tools',
        'bottom-left',
        'bottom-right',
      ]);
      const sheet = await boxOf(detailsSheet(page));
      const bar = await boxOf(selectionSurface(page));
      expect([sheet.x, sheet.width, sheet.y + sheet.height]).toEqual([
        0,
        viewport.width,
        viewport.height,
      ]);
      expect(sheet.y).toBeGreaterThanOrEqual(bar.y + bar.height);
      expect(sheet.height).toBeLessThanOrEqual(0.62 * viewport.height + 0.5);
      await page.keyboard.press('Escape');
      await expect(detailsSheet(page)).toHaveCount(0);
      await expect(panelButton(page, 'Details')).toBeFocused();
      await expect(selectionSurface(page).getByRole('heading')).toHaveText('Rectangle');
      await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
      await tap(page, 'Details');
      await button(page, 'Close Details').tap();
      await expect(panelButton(page, 'Details')).toBeFocused();
      await expect(panelButton(page, 'Details')).toHaveAttribute('aria-expanded', 'false');
      expect(await page.evaluate<string[]>(INERT)).toEqual([]);
    });
  });
}

test.describe('at 390 × 844 with touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('D4 Delete on the bar removes the bar and the sheet and focuses the canvas, and a tap on empty canvas above the sheet closes it', async ({
    page,
  }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    await tap(page, 'Details');
    await tap(page, 'Delete');
    await expect(polite(page)).toHaveText('Deleted 1 rectangle. Nothing selected.');
    await expect(selectionSurface(page)).toHaveCount(0);
    await expect(detailsSheet(page)).toHaveCount(0);
    await expect(canvas(page)).toBeFocused();
    await onCanvas(page, ['ControlOrMeta+Z'], 'Undid deletion of 1 rectangle. 1 element selected.');
    await tap(page, 'Details');
    const sheet = await boxOf(detailsSheet(page));
    await page.touchscreen.tap(20, sheet.y - 30);
    await expect(polite(page)).toHaveText('Nothing selected.');
    await expect(detailsSheet(page)).toHaveCount(0);
    await expect(selectionSurface(page)).toHaveCount(0);
  });

  test('D4 A7 Elements with Details open, and Details with the Elements sheet open, keep one sheet open and focused', async ({
    page,
  }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    await tap(page, 'Details');
    await elementsToggle(page).tap();
    await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(elementList(page)).toBeFocused();
    await expect(detailsSheet(page)).toHaveCount(0);
    await expect(panelButton(page, 'Details')).toHaveAttribute('aria-expanded', 'false');
    await tap(page, 'Details');
    await expect(button(page, 'Close Details')).toBeFocused();
    await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(elementList(page)).toHaveCount(0);
  });

  test('D3 Edit text on the bar opens the text area with the text’s words', async ({ page }) => {
    await openPage(page);
    await drawText(page, ['Plan']);
    await tap(page, 'Edit text');
    const area = page.getByRole('textbox', { name: 'Text' });
    await expect(area).toBeFocused();
    await expect(area).toHaveValue('Plan');
    await expect(selectionSurface(page)).toHaveCount(0);
  });

  test('D4 A7 the sheet is closed after a reload', async ({ page }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    await expectSaved(page);
    await tap(page, 'Details');
    await expect(detailsSheet(page)).toBeVisible();
    await page.reload();
    await expect(canvas(page)).toBeVisible();
    await expect(selectionSurface(page)).toBeVisible();
    await expect(panelButton(page, 'Details')).toHaveAttribute('aria-expanded', 'false');
    await expect(detailsSheet(page)).toHaveCount(0);
  });
});

test.describe('in a landscape window, 844 × 390', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('D3 the panel shows, not the bar', async ({ page }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    await expect(
      selectionSurface(page).getByText('Style controls are not in this build.'),
    ).toBeVisible();
    await expect(panelButton(page, 'Details')).toHaveCount(0);
    expect((await boxOf(selectionSurface(page))).width).toBe(232);
  });
});
