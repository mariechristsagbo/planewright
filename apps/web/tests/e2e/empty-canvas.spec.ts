import { expect, test } from '@playwright/test';

import { openPage, polite } from './a11y.ts';
import { expectSaved, refuseStorage, saveState, saveStatus, storageNotices } from './storage.ts';
import { canvas } from './support.ts';
import { textArea } from './text.ts';

// The empty-canvas note (ADR 0012, D5, issue #55's A8): over an empty drawing it repeats the
// pre-release sentence that About this build holds; it goes once an element exists, does not show
// while a text is edited, and lets every press through to the canvas. While nothing is saved, it
// leaves out the sentence's saving clause, and the storage notice says why (issue #86).

const SENTENCE =
  'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them; the drawing is saved in this browser, but there are no files or collaboration yet.';
const UNSAVED_SENTENCE =
  'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them, but there are no files or collaboration yet.';
const UNAVAILABLE_NOTICE =
  'Saving is unavailable in this browser: the drawing stays in this tab only and is lost when the tab closes.';

test('A8 the empty-canvas note shows on an empty drawing, not during a text session, and goes once an element exists', async ({
  page,
}) => {
  await openPage(page);
  const note = page.getByText(SENTENCE, { exact: true });
  await expect(note).toBeVisible();
  await canvas(page).focus();
  await page.keyboard.press('t');
  await page.keyboard.press('Enter');
  await expect(textArea(page)).toBeFocused();
  await expect(note).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(textArea(page)).toHaveCount(0);
  await expect(note).toBeVisible();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await expect(note).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(note).toBeVisible();
  await page.keyboard.press('Control+Shift+z');
  await expect(note).toHaveCount(0);
  await expectSaved(page);
  await page.reload();
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByText('View: x 0, y 0, zoom 100%')).toBeVisible();
  await expect(note).toHaveCount(0);
});

test('A8 REQ-C11 a press where the note shows reaches the canvas', async ({ page }) => {
  await openPage(page);
  const note = page.getByText(SENTENCE, { exact: true });
  const box = await note.boundingBox();
  if (box === null) throw new Error('The empty-canvas note is not laid out.');
  await canvas(page).focus();
  await page.keyboard.press('r');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await expect(note).toHaveCount(0);
});

test('REQ-P07 with storage refused before the load, the note does not say that the drawing is saved, beside the notice that says it stays in this tab', async ({
  page,
}) => {
  await refuseStorage(page);
  await openPage(page);
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'none');
  await expect(storageNotices(page)).toContainText(UNAVAILABLE_NOTICE);
  await expect(saveStatus(page)).toHaveText('Not saved');
  const note = page.getByText(UNSAVED_SENTENCE, { exact: true });
  await expect(note).toBeVisible();
  await expect(page.getByText(SENTENCE, { exact: true })).toHaveCount(0);
  const body = page.locator('body');
  await expect(body).not.toContainText(/saved in (this|the) browser/u, { useInnerText: true });
  await canvas(page).focus();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await expect(note).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(note).toBeVisible();
  await expect(body).not.toContainText(/saved in (this|the) browser/u, { useInnerText: true });
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'none');
  await expect(storageNotices(page)).toContainText(UNAVAILABLE_NOTICE);
});
