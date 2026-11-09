import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

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

export const saveStatus = (page: Page): Locator => page.locator('#save-status');

/** Waits until the page says the drawing is saved in this browser. */
export const expectSaved = (page: Page): Promise<void> =>
  expect(saveStatus(page)).toHaveText('Saved in this browser');

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
