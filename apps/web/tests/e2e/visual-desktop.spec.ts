import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { button, elementList, elementsToggle, openPage } from './a11y.ts';
import { mouseClick } from './drawing.ts';
import { elementCount, openFixture } from './fixture-page.ts';
import { panelButton, selectionSurface } from './panel.ts';
import { hintChip } from './session.ts';
import {
  hideNotices,
  refusableWrites,
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
  PARK,
  RECTANGLE,
  SANS_AGAIN,
  VISUAL_CONTEXT,
  canvasFocusVisible,
  emptyNote,
  ready,
} from './visual.ts';

// ADR 0012's visual-regression matrix at 1440 × 900, its first row and its pixel-ratio check
// (decision 17; the v0.2 plan's S13): each state reached through the controls, keys and storage
// helpers that exist, proven by roles, names, ids and data-save-state, then captured with every
// animation finished and compared with its Linux baseline, made by CI's Chromium. The rectangle
// that the storage helpers draw stays selected at the canvas's centre, and the canvas keeps the
// keyboard focus that they gave it, until a press on Hide gives it to the problem chip (V12).

test.use({ ...VISUAL_CONTEXT, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const WITH_FIXTURE = { touch: false, fixture: true };
const WITHOUT_FIXTURE = { touch: false, fixture: false };

/** The rest state: saved, no problem chip, the fixture counted and no selection surface. */
async function expectRest(page: Page): Promise<void> {
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'saved');
  await expect(saveStatus(page)).toHaveCount(0);
  await expect(elementCount(page)).toHaveText('15');
  await expect(selectionSurface(page)).toHaveCount(0);
}

/** The canvas holds the keyboard focus and shows its ring, as the storage helpers leave it. */
async function expectCanvasFocusVisible(page: Page): Promise<void> {
  await expect(canvas(page)).toBeFocused();
  expect(await canvasFocusVisible(page)).toBe(true);
}

/** The storage helpers' rectangle, selected at the canvas's centre with the canvas focused. */
async function expectHelperRectangle(page: Page, count: number): Promise<void> {
  await expect(elementCount(page)).toHaveText(String(count));
  await expect(selectionSurface(page)).toContainText('Rectangle');
  await expectCanvasFocusVisible(page);
}

test('V01 1440 × 900 rest, the top-right island holding only Elements', async ({ page }) => {
  await openFixture(page);
  await expectRest(page);
  await expect(page.locator('[data-island="top-right"]').getByRole('button')).toHaveCount(1);
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-rest.png');
});

test('V02 1440 × 900 single selection, the first rectangle pressed', async ({ page }) => {
  await openFixture(page);
  await mouseClick(page, RECTANGLE);
  await expect(selectionSurface(page)).toContainText('Rectangle');
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-single-selection.png');
});

test('V03 1440 × 900 multi-selection, Select all after a press on the empty canvas', async ({
  page,
}) => {
  await openFixture(page);
  await mouseClick(page, PARK);
  await page.keyboard.press('Control+a');
  await expect(selectionSurface(page)).toContainText('15');
  expect(await canvasFocusVisible(page)).toBe(false);
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-multi-selection.png');
});

test('V04 1440 × 900 text selected, "sans again" pressed', async ({ page }) => {
  await openFixture(page);
  await mouseClick(page, SANS_AGAIN);
  await expect(selectionSurface(page)).toContainText('Text');
  await expect(panelButton(page, 'Edit text')).toBeVisible();
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-text-selected.png');
});

test('V05 1440 × 900 text editing, from Edit text on "sans again"', async ({ page }) => {
  await openFixture(page);
  await mouseClick(page, SANS_AGAIN);
  await panelButton(page, 'Edit text').click();
  await expect(textArea(page)).toBeFocused();
  await expect(textArea(page)).toHaveValue('sans again');
  await expect(hintChip(page)).toContainText('Esc');
  await expect(hintChip(page)).toContainText('Ctrl+Enter');
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-text-editing.png');
});

test('V06 1440 × 900 menu, opened by a press, the focus on Select all', async ({ page }) => {
  await openFixture(page);
  await button(page, 'Planewright menu').click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Select all/u })).toBeFocused();
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-menu.png');
});

test('V07 1440 × 900 shortcuts, from the bottom-right button', async ({ page }) => {
  await openFixture(page);
  await button(page, 'Keyboard shortcuts').click();
  await expect(page.locator('#keyboard-shortcuts')).toHaveAttribute('open', '');
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-shortcuts.png');
});

test('V08 1440 × 900 About, from the Pre-release tag', async ({ page }) => {
  await openFixture(page);
  await button(page, 'Pre-release').click();
  await expect(page.locator('#about-this-build')).toHaveAttribute('open', '');
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-about.png');
});

test('V09 1440 × 900 drawer open, from the Elements toggle', async ({ page }) => {
  await openFixture(page);
  await elementsToggle(page).click();
  await expect(elementList(page).getByRole('option')).toHaveCount(15);
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-drawer-open.png');
});

test('V10 1440 × 900 stale notice, from showStaleNotice', async ({ page }) => {
  await openFixture(page);
  await showStaleNotice(page);
  await expect(
    storageNotices(page).getByRole('button', { name: 'Keep this version' }),
  ).toBeVisible();
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'stale');
  await expectHelperRectangle(page, 16);
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-stale-notice.png');
});

/** Opens the fixture with refusable writes and shows the failed notice over it. */
async function failedNotice(page: Page): Promise<void> {
  await refusableWrites(page);
  await openFixture(page);
  await showFailedNotice(page);
}

test('V11 1440 × 900 failed notice, from showFailedNotice', async ({ page }) => {
  await failedNotice(page);
  await expect(storageNotices(page)).toContainText('Saving failed:');
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'failed');
  await expectHelperRectangle(page, 16);
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-failed-notice.png');
});

test('V12 1440 × 900 notices hidden, the failed notice folded into the chip button', async ({
  page,
}) => {
  await failedNotice(page);
  await hideNotices(page);
  await expect(storageNotices(page)).toHaveCount(0);
  await expect(saveStatus(page)).toHaveRole('button');
  await expect(saveStatus(page)).toBeFocused();
  expect(await canvasFocusVisible(page)).toBe(false);
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'failed');
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-notices-hidden.png');
});

test('V13 1440 × 900 empty, a fresh page with nothing stored', async ({ page }) => {
  await openPage(page);
  await expect(emptyNote(page)).toBeVisible();
  await expect(elementCount(page)).toHaveText('0');
  expect((await storedRecords(page)).elements).toEqual([]);
  await ready(page, WITHOUT_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-empty.png');
});

test('V14 1440 × 900 canvas focus, by Tab from the start of the page', async ({ page }) => {
  await openFixture(page);
  for (let stop = 0; stop < 4; stop += 1) await page.keyboard.press('Tab');
  await expectCanvasFocusVisible(page);
  await expect(page.getByText('Canvas focused', { exact: true })).toBeVisible();
  await ready(page, WITH_FIXTURE);
  await expect(page).toHaveScreenshot('1440x900-canvas-focus.png');
});

test.describe('at two device pixels per CSS pixel', () => {
  test.use({ deviceScaleFactor: 2 });

  test('V30 1440 × 900 rest at device scale factor 2, as a pixel-ratio check', async ({ page }) => {
    await openFixture(page);
    await expectRest(page);
    expect(await page.evaluate('devicePixelRatio')).toBe(2);
    const image = await page.screenshot({ scale: 'device' });
    expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([2880, 1800]);
    await ready(page, WITH_FIXTURE);
    await expect(page).toHaveScreenshot('1440x900-dpr2-rest.png', { scale: 'device' });
  });
});
