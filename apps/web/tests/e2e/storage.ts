import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { canvas } from './support.ts';

// The page's IndexedDB as the end-to-end tests read and spoil it, through the browser's own API in
// the page (docs/architecture/engine/persistence.md#indexeddb-layout). Each test runs in a new
// browser context, so storage starts empty. Call these only once the page has opened its database.

export interface StoredRecords {
  readonly documents: readonly Readonly<Record<string, unknown>>[];
  readonly elements: readonly Readonly<Record<string, unknown>>[];
}

const OPEN = `new Promise((resolve, reject) => {
  const request = indexedDB.open('planewright');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
})`;

const READ = `(async () => {
  const database = await ${OPEN};
  const all = (name) => new Promise((resolve, reject) => {
    const request = database.transaction(name).objectStore(name).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const records = { documents: await all('documents'), elements: await all('elements') };
  database.close();
  return records;
})()`;

/** Every document and element record the page's database holds. */
export const storedRecords = (page: Page): Promise<StoredRecords> =>
  page.evaluate<StoredRecords>(READ);

/** Writes a document record as it is, with the page's current time as its update time. */
export async function putDocumentRecord(
  page: Page,
  record: Readonly<Record<string, unknown>>,
): Promise<void> {
  await page.evaluate(`(async () => {
    const database = await ${OPEN};
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('documents', 'readwrite');
      transaction.objectStore('documents').put({ ...${JSON.stringify(record)}, updated: Date.now() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  })()`);
}

/** The problem chip, which shows only while storage needs attention (ADR 0012, decision 12). */
export const saveStatus = (page: Page): Locator => page.locator('#save-status');

/** The shell's root, whose data-save-state follows view.save, for the tests alone (decision 16). */
export const saveState = (page: Page): Locator => page.locator('[data-save-state]');

/** The storage notices under the top-right island, which are no alerts (REQ-Y04). */
export const storageNotices = (page: Page): Locator =>
  page.getByRole('region', { name: 'Storage notices' });

/** The assertive live region, which says failed and stale saves and start-up notices (REQ-Y04). */
export const urgentAnnouncement = (page: Page): Locator => page.locator('#live-assertive');

/** Waits until the drawing is saved in this browser, as the shell root's save state says. */
export const expectSaved = (page: Page): Promise<void> =>
  expect(saveState(page)).toHaveAttribute('data-save-state', 'saved');

/**
 * Shows the stale notice on an open page: it saves a rectangle, a second page of its context saves
 * an ellipse over it, and the page's next save, a nudge, is refused as stale.
 */
export async function showStaleNotice(page: Page): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expectSaved(page);
  const second = await page.context().newPage();
  await second.goto('/');
  await canvas(second).focus();
  await second.keyboard.press('o');
  await second.keyboard.press('Enter');
  await expectSaved(second);
  await page.bringToFront();
  await canvas(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    storageNotices(page).getByRole('button', { name: 'Keep this version' }),
  ).toBeVisible();
}

/** Makes the page's IndexedDB impossible to open, before any of its scripts runs. */
export async function refuseStorage(page: Page): Promise<void> {
  await page.addInitScript(`IDBFactory.prototype.open = function () {
    throw new DOMException('Storage is disabled.', 'SecurityError');
  };`);
}

/** Lets the test make every element write fail while `window.refuseWrites` is true. */
export async function refusableWrites(page: Page): Promise<void> {
  await page.addInitScript(`(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...values) {
      if (window.refuseWrites && this.name === 'elements') {
        throw new DOMException('The write was refused.', 'UnknownError');
      }
      return put.apply(this, values);
    };
  })();`);
}

export const setRefuseWrites = (page: Page, refuse: boolean): Promise<unknown> =>
  page.evaluate(`window.refuseWrites = ${String(refuse)}`);
