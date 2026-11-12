import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { elementList, elementsToggle, openPage } from './a11y.ts';
import { moreButton, toolButton, touch } from './drawing.ts';
import type { Point } from './drawing.ts';
import { elementCount, openFixture } from './fixture-page.ts';
import { panelButton, selectionSurface } from './panel.ts';
import { doneBar } from './session.ts';
import {
  refusableWrites,
  refuseStorage,
  saveState,
  saveStatus,
  showFailedNotice,
  showStaleNotice,
  storageNotices,
  storedRecords,
} from './storage.ts';
import { canvas } from './support.ts';
import { textArea } from './text.ts';
import {
  RECTANGLE,
  SANS_AGAIN,
  VISUAL_CONTEXT,
  canvasFocusVisible,
  emptyNote,
  ready,
} from './visual.ts';

// ADR 0012's visual-regression matrix on touch screens, its rows at 1024 × 768, 390 × 844 and
// 844 × 390 (decision 17; the v0.2 plan's S13): emulated touch at one device pixel per CSS pixel,
// each state reached by taps, keys and the storage helpers, never a hover, proven by roles, names,
// ids and data-save-state, then captured with every animation finished and compared with its Linux
// baseline, made by CI's Chromium. Safe-area insets are 0 and no on-screen keyboard is emulated.

const TOUCH = { ...VISUAL_CONTEXT, deviceScaleFactor: 1, hasTouch: true, isMobile: true } as const;
const WITH_FIXTURE = { touch: true, fixture: true };
const WITHOUT_FIXTURE = { touch: true, fixture: false };

/** The rest state: saved, no problem chip, the fixture counted and no selection surface. */
async function expectRest(page: Page): Promise<void> {
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'saved');
  await expect(saveStatus(page)).toHaveCount(0);
  await expect(elementCount(page)).toHaveText('15');
  await expect(selectionSurface(page)).toHaveCount(0);
}

/**
 * Taps a fixture element until the panel or the bar names its kind: under load a tap is lost now
 * and then, and a tap is repeated only while nothing is selected.
 */
async function tapToSelect(page: Page, at: Point, kind: string): Promise<void> {
  await expect(async () => {
    if ((await selectionSurface(page).count()) === 0) await touch(page, at);
    await expect(selectionSurface(page)).toContainText(kind, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

/** Taps the Elements toggle until it is expanded, then waits for the fixture's 15 options. */
async function tapElements(page: Page): Promise<void> {
  const toggle = elementsToggle(page);
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await expect(elementList(page).getByRole('option')).toHaveCount(15);
}

/** The storage helpers' rectangle, selected at the canvas's centre, the canvas focused with its ring. */
async function expectHelperRectangle(page: Page): Promise<void> {
  await expect(elementCount(page)).toHaveText('16');
  await expect(selectionSurface(page)).toContainText('Rectangle');
  await expect(canvas(page)).toBeFocused();
  expect(await canvasFocusVisible(page)).toBe(true);
}

test.describe('1024 × 768, touch', () => {
  test.use({ ...TOUCH, viewport: { width: 1024, height: 768 } });

  test('V15 1024 × 768 touch rest', async ({ page }) => {
    await openFixture(page);
    await expectRest(page);
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('1024x768-touch-rest.png');
  });

  test('V16 1024 × 768 touch selection and drawer', async ({ page }) => {
    await openFixture(page);
    await tapToSelect(page, RECTANGLE, 'Rectangle');
    await tapElements(page);
    await expect(selectionSurface(page)).toContainText('Rectangle');
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('1024x768-touch-selection-and-drawer.png');
  });

  test('V17 1024 × 768 touch start-up unavailable, storage refused before the load', async ({
    page,
  }) => {
    await refuseStorage(page);
    await openPage(page);
    await expect(storageNotices(page)).toBeVisible();
    await expect(saveState(page)).toHaveAttribute('data-save-state', 'none');
    await ready(page, WITHOUT_FIXTURE);
    await expect(page).toHaveScreenshot('1024x768-touch-startup-unavailable.png');
  });
});

test.describe('390 × 844, touch', () => {
  test.use({ ...TOUCH, viewport: { width: 390, height: 844 } });

  test('V18 390 × 844 touch rest, the dock shown', async ({ page }) => {
    await openFixture(page);
    await expectRest(page);
    await expect(moreButton(page)).toBeVisible();
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('390x844-touch-rest.png');
  });

  test('V19 390 × 844 touch selection bar, the first rectangle tapped', async ({ page }) => {
    await openFixture(page);
    await tapToSelect(page, RECTANGLE, 'Rectangle');
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('390x844-touch-selection-bar.png');
  });

  test('V20 390 × 844 touch Details sheet, from the bar’s Details', async ({ page }) => {
    await openFixture(page);
    await tapToSelect(page, RECTANGLE, 'Rectangle');
    await panelButton(page, 'Details').tap();
    await expect(page.locator('#details-sheet')).toBeVisible();
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('390x844-touch-details-sheet.png');
  });

  test('V21 390 × 844 touch More open', async ({ page }) => {
    await openFixture(page);
    await moreButton(page).tap();
    const more = page.locator('#more-tools');
    for (const name of ['Hand', 'Diamond', 'Tool lock']) {
      await expect(more.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('390x844-touch-more-open.png');
  });

  test('V22 390 × 844 touch Elements sheet', async ({ page }) => {
    await openFixture(page);
    await tapElements(page);
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('390x844-touch-elements-sheet.png');
  });

  test('V23 390 × 844 touch text editing with the Done bar, from Edit text on "sans again"', async ({
    page,
  }) => {
    await openFixture(page);
    await tapToSelect(page, SANS_AGAIN, 'Text');
    await panelButton(page, 'Edit text').tap();
    await expect(textArea(page)).toBeFocused();
    await expect(doneBar(page)).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeHidden();
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('390x844-touch-text-editing.png');
  });

  test('V24 390 × 844 touch stale notice, from showStaleNotice', async ({ page }) => {
    await openFixture(page);
    await showStaleNotice(page);
    await expect(
      storageNotices(page).getByRole('button', { name: 'Keep this version' }),
    ).toBeVisible();
    await expect(saveState(page)).toHaveAttribute('data-save-state', 'stale');
    await expectHelperRectangle(page);
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('390x844-touch-stale-notice.png');
  });

  test('V25 390 × 844 touch empty, a fresh page with nothing stored', async ({ page }) => {
    await openPage(page);
    await expect(emptyNote(page)).toBeVisible();
    await expect(elementCount(page)).toHaveText('0');
    expect((await storedRecords(page)).elements).toEqual([]);
    await ready(page, WITHOUT_FIXTURE);
    await expect(page).toHaveScreenshot('390x844-touch-empty.png');
  });
});

test.describe('844 × 390, touch', () => {
  test.use({ ...TOUCH, viewport: { width: 844, height: 390 } });

  test('V26 844 × 390 touch rest, the whole palette in the top row', async ({ page }) => {
    await openFixture(page);
    await expectRest(page);
    await expect(moreButton(page)).toHaveCount(0);
    for (const name of ['Hand', 'Diamond', 'Tool lock']) {
      await expect(toolButton(page, name)).toBeVisible();
    }
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('844x390-touch-rest.png');
  });

  test('V27 844 × 390 touch selection and drawer', async ({ page }) => {
    await openFixture(page);
    await tapToSelect(page, RECTANGLE, 'Rectangle');
    await tapElements(page);
    await expect(selectionSurface(page)).toContainText('Rectangle');
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('844x390-touch-selection-and-drawer.png');
  });

  test('V28 844 × 390 touch tool lock, tapped in the top-row palette', async ({ page }) => {
    await openFixture(page);
    await toolButton(page, 'Tool lock').tap();
    await expect(toolButton(page, 'Tool lock')).toHaveAttribute('aria-pressed', 'true');
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('844x390-touch-tool-lock.png');
  });

  test('V29 844 × 390 touch failed notice, the chip showing its glyph alone', async ({ page }) => {
    await refusableWrites(page);
    await openFixture(page);
    await showFailedNotice(page);
    await expect(storageNotices(page)).toContainText('Saving failed:');
    await expect(saveState(page)).toHaveAttribute('data-save-state', 'failed');
    await expectHelperRectangle(page);
    await expect(saveStatus(page).locator('svg[data-glyph="status-problem"]')).toBeVisible();
    const words = await saveStatus(page).locator('.problem-chip-words').boundingBox();
    expect(words?.width ?? 0).toBeLessThanOrEqual(1);
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('844x390-touch-failed-notice.png');
  });
});
