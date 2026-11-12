import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { elementsToggle } from './a11y.ts';
import { fixtureRecords } from './scene-fixture.ts';
import { canvas } from './support.ts';

// The seeded scene of scene-fixture.ts as a page opens it (ADR 0012, decision 17; the v0.2 plan's
// S13): its records written into the page's IndexedDB as a first save writes them, then the page
// opened again with its frames measured. Page code is written as strings, since these files
// compile without the DOM library.

/** The fixture's document id, which every page that opens the fixture stores it under. */
export const FIXTURE_DOCUMENT_ID = 'SceneFixtureDocument00';

/** The number that the Elements toggle shows: the stored elements, drawn in view or not. */
export const elementCount = (page: Page) => elementsToggle(page).locator('.toggle-count');

/**
 * Opens the page, stores the fixture through IndexedDB, opens the page again with `?measure`, and
 * waits until the Elements toggle counts the fixture's elements and the scene has been drawn. Part
 * of the fixture lies outside a phone's view, where it is not drawn, so the wait counts the stored
 * elements rather than the drawn ones, and holds at every width. Gives the fixture's element count.
 */
export async function openFixture(page: Page): Promise<number> {
  await page.goto('/');
  await expect(canvas(page)).toBeVisible();
  const { record, elements, count } = fixtureRecords(FIXTURE_DOCUMENT_ID);
  await page.evaluate(`(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('planewright');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['documents', 'elements'], 'readwrite');
      transaction.objectStore('documents').put({ ...${JSON.stringify(record)}, updated: Date.now() });
      const store = transaction.objectStore('elements');
      for (const element of ${JSON.stringify(elements)}) store.put(element);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  })()`);
  await page.goto('/?measure');
  await expect(elementCount(page)).toHaveText(String(count));
  await page.waitForFunction(
    `performance.getEntriesByName('planewright:render-scene').some((entry) => entry.detail.elements > 0)`,
  );
  return count;
}
