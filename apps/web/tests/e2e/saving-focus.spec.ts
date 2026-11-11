import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { elementsToggle, expectIndicator, openPage } from './a11y.ts';
import {
  expectSaved,
  hideNotices,
  refusableWrites,
  saveStatus,
  setRefuseWrites,
  showFailedNotice,
  showStaleNotice,
  storageNotices,
} from './storage.ts';
import { canvas } from './support.ts';

// The tab order while storage needs attention (ADR 0012, decision 14; the v0.2 plan's S7, issue
// #71's D6): from the canvas with a selection, the selection panel's actions, then the notices'
// buttons, Hide last, or the chip's button once they are hidden, then Elements; nothing about
// saving while it works. Each stop shows its indicator, forwards and backwards.

const panelButton = (page: Page, name: string): Locator =>
  page.locator('[data-island="selection"]').getByRole('button', { name });

const noticeButton = (page: Page, name: string): Locator =>
  storageNotices(page).getByRole('button', { name });

/** Tabs from the canvas through the stops to Elements and back, each focused and indicated. */
async function expectStops(page: Page, stops: readonly Locator[]): Promise<void> {
  await canvas(page).focus();
  for (const stop of [...stops, elementsToggle(page)]) {
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
    await expectIndicator(page);
  }
  for (const stop of [...stops].reverse().concat(canvas(page))) {
    await page.keyboard.press('Shift+Tab');
    await expect(stop).toBeFocused();
    await expectIndicator(page);
  }
}

test('D6 A8 under the stale notice the stops are the panel’s actions, Load, Keep, Hide, then Elements', async ({
  page,
}) => {
  await openPage(page);
  await showStaleNotice(page);
  await expectStops(page, [
    panelButton(page, 'Duplicate'),
    panelButton(page, 'Delete'),
    noticeButton(page, 'Load the newer version'),
    noticeButton(page, 'Keep this version'),
    noticeButton(page, 'Hide storage notices'),
  ]);
});

test('D6 A8 under the failed notice the stops are the panel’s actions and Hide, the chip’s button once hidden, and none once saving works again', async ({
  page,
}) => {
  await refusableWrites(page);
  await openPage(page);
  await showFailedNotice(page);
  const actions = [panelButton(page, 'Duplicate'), panelButton(page, 'Delete')];
  await expectStops(page, [...actions, noticeButton(page, 'Hide storage notices')]);
  await hideNotices(page);
  await expect(storageNotices(page)).toHaveCount(0);
  await expectStops(page, [...actions, saveStatus(page)]);
  await setRefuseWrites(page, false);
  await expectSaved(page);
  await expect(saveStatus(page)).toHaveCount(0);
  await expectStops(page, actions);
});
