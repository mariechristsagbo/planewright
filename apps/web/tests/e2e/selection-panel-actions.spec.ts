import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

import { button, elementsToggle, expectIndicator, openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { drawText, onCanvas, panelButton, selectionSurface } from './panel.ts';
import { showStaleNotice, storageNotices } from './storage.ts';
import { canvas } from './support.ts';

// The selection panel's actions on a desktop (issue #69's D2, A4 and A5): Duplicate, Delete and
// Edit text run their existing commands, said in the polite region as their keys say them; Edit
// text shows only where Enter on the canvas edits the lone selected text; and the actions are the
// tab stops between the canvas and the notices' answers and Elements.

test.use({ viewport: { width: 1280, height: 720 } });

/** The number that the Elements toggle shows. */
const count = (page: Parameters<typeof canvas>[0]): Locator =>
  elementsToggle(page).locator('.toggle-count');

test('D2 A4 Duplicate adds one element, said as Mod+D says it, keeps the focus, and one Undo removes it', async ({
  page,
}) => {
  await openPage(page);
  await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
  await panelButton(page, 'Duplicate').click();
  await expect(polite(page)).toHaveText(/^Duplicated /u);
  const said = await polite(page).textContent();
  await expect(count(page)).toHaveText('2');
  await expect(panelButton(page, 'Duplicate')).toBeFocused();
  await button(page, 'Undo').click();
  await expect(count(page)).toHaveText('1');
  await onCanvas(page, ['ControlOrMeta+D'], said ?? '');
  await expect(count(page)).toHaveText('2');
});

test('D2 A4 A5 Delete removes the selection, said as the Delete key says it, and leaves the focus on the canvas', async ({
  page,
}) => {
  await openPage(page);
  await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
  await panelButton(page, 'Delete').click();
  await expect(polite(page)).toHaveText('Deleted 1 rectangle. Nothing selected.');
  await expect(selectionSurface(page)).toHaveCount(0);
  await expect(canvas(page)).toBeFocused();
  await expect(count(page)).toHaveText('0');
  await button(page, 'Undo').click();
  await expect(count(page)).toHaveText('1');
  await onCanvas(page, ['Delete'], 'Deleted 1 rectangle. Nothing selected.');
});

test('D2 A5 Edit text opens the lone text’s text area, focused, the panel gone meanwhile; Escape ends it, and Tab reaches Duplicate', async ({
  page,
}) => {
  await openPage(page);
  await drawText(page, ['Plan']);
  await panelButton(page, 'Edit text').click();
  const area = page.getByRole('textbox', { name: 'Text' });
  await expect(area).toBeFocused();
  await expect(area).toHaveValue('Plan');
  await expect(selectionSurface(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(canvas(page)).toBeFocused();
  await expect(area).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(panelButton(page, 'Duplicate')).toBeFocused();
});

test('D2 A3 Edit text is absent with tool lock and the Text tool, with Hand, and in a multi-selection', async ({
  page,
}) => {
  await openPage(page);
  await drawText(page, ['Plan']);
  await expect(panelButton(page, 'Edit text')).toBeVisible();
  // Hand keeps the selection, and Enter would do nothing.
  await onCanvas(page, ['h'], 'Text created. 1 element selected.');
  await expect(toolButton(page, 'Hand')).toHaveAttribute('aria-pressed', 'true');
  await expect(selectionSurface(page).getByRole('heading')).toHaveText('Text');
  await expect(panelButton(page, 'Edit text')).toHaveCount(0);
  // Among several elements, Enter edits nothing.
  await onCanvas(page, ['v', 'r', 'Enter', 'ControlOrMeta+A'], '2 elements selected.');
  await expect(panelButton(page, 'Edit text')).toHaveCount(0);
  // Tool lock keeps the Text tool after a text is made, with nothing selected; with the rectangle
  // undone, Select all selects the lone text with the Text tool still active, where Enter would
  // create another text.
  await onCanvas(page, ['ControlOrMeta+Z', 'q', 't', 'ControlOrMeta+A'], '1 element selected.');
  await expect(toolButton(page, 'Text')).toHaveAttribute('aria-pressed', 'true');
  await expect(toolButton(page, 'Tool lock')).toHaveAttribute('aria-pressed', 'true');
  await expect(selectionSurface(page).getByRole('heading')).toHaveText('Text');
  await expect(panelButton(page, 'Duplicate')).toBeVisible();
  await expect(panelButton(page, 'Edit text')).toHaveCount(0);
});

test('D2 A5 REQ-Y02 with a selection, Tab goes from the canvas through the panel’s actions to the stale notice’s answers, its Hide and Elements, and back', async ({
  page,
}) => {
  await openPage(page);
  await showStaleNotice(page);
  await drawText(page, ['Plan']);
  const notices = storageNotices(page);
  const stops = [
    canvas(page),
    panelButton(page, 'Duplicate'),
    panelButton(page, 'Delete'),
    panelButton(page, 'Edit text'),
    notices.getByRole('button', { name: 'Load the newer version' }),
    notices.getByRole('button', { name: 'Keep this version' }),
    // Hide is the notices' last control since S7.
    notices.getByRole('button', { name: 'Hide storage notices' }),
    elementsToggle(page),
  ];
  for (const stop of stops.slice(1)) {
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
    await expectIndicator(page);
  }
  for (const stop of stops.slice(0, -1).reverse()) {
    await page.keyboard.press('Shift+Tab');
    await expect(stop).toBeFocused();
  }
});
