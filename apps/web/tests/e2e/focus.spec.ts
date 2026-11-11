import { expect, test } from '@playwright/test';

import {
  button,
  elementList,
  elementsToggle,
  expectIndicator,
  expectOptionNames,
  openElements,
  openPage,
  polite,
} from './a11y.ts';
import { toolButton } from './drawing.ts';
import { expectSaved, storageNotices } from './storage.ts';
import { canvas } from './support.ts';

// Focus on a desktop keyboard (ENG-14, docs/architecture/engine/quality.md#accessibility): the tab
// stops in the specified order, each with a visible indicator, and the focus never left on the
// page when a control or the text area goes away (REQ-Y02).

test('E2 A7 A8 REQ-Y02 Tab visits the menu, Pre-release, the tool bar, the canvas, Elements, the open drawer’s Close, keys and list, the history and zoom controls and Keyboard shortcuts, each with a visible indicator', async ({
  page,
}) => {
  await openPage(page);
  const stops = [
    button(page, 'Planewright menu'),
    button(page, 'Pre-release'),
    toolButton(page, 'Hand'),
    canvas(page),
    elementsToggle(page),
    button(page, 'Undo'),
    button(page, 'Redo'),
    button(page, 'Zoom out'),
    button(page, /^Reset zoom/u),
    button(page, 'Zoom in'),
    button(page, 'Zoom to fit'),
    button(page, 'Keyboard shortcuts'),
  ];
  for (const stop of stops) {
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
    await expectIndicator(page);
  }
  // "Source on GitHub" is in the menu and About this build now, so Keyboard shortcuts is the last
  // stop.
  await expect(page.getByRole('link', { name: 'Source on GitHub' })).toHaveCount(0);
  for (const stop of stops.slice(0, -1).reverse()) {
    await page.keyboard.press('Shift+Tab');
    await expect(stop).toBeFocused();
  }
  // While the drawer is open, its Close, its keys' summary and the list box follow Elements, and
  // opening it puts the focus on the list box (ADR 0012, decision 14; the v0.2 plan's S5).
  for (const stop of stops.slice(1, 5)) {
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(elementList(page)).toBeFocused();
  await expectIndicator(page);
  await page.keyboard.press('Tab');
  await expect(button(page, 'Undo')).toBeFocused();
  for (const stop of [
    elementList(page),
    page.locator('#element-list-drawer summary'),
    button(page, 'Close Elements'),
    elementsToggle(page),
  ]) {
    await page.keyboard.press('Shift+Tab');
    await expect(stop).toBeFocused();
    await expectIndicator(page);
  }
  await page.keyboard.press('Enter');
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(elementsToggle(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(button(page, 'Undo')).toBeFocused();
});

test('E2 D5 C3 REQ-Y02 Escape in the text area gives the focus back to the canvas, and Tab ends the session', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.keyboard.press('t');
  await page.keyboard.press('Enter');
  const area = page.getByRole('textbox', { name: 'Text' });
  await expect(area).toBeFocused();
  await expectIndicator(page);
  await page.keyboard.type('Hi');
  await page.keyboard.press('Escape');
  await expect(canvas(page)).toBeFocused();
  await expect(polite(page)).toHaveText('Text created. 1 element selected.');

  await page.keyboard.press('Enter');
  await expect(area).toBeFocused();
  // The selection panel is out of the page while the text is edited (S6), so the next stop after
  // the text area is Elements; the session ends, and the panel's actions come back before it.
  await page.keyboard.press('Tab');
  await expect(elementsToggle(page)).toBeFocused();
  await expect(area).toHaveCount(0);
  const panel = page.locator('[data-island="selection"]');
  for (const stop of [
    panel.getByRole('button', { name: 'Edit text' }),
    panel.getByRole('button', { name: 'Delete' }),
    panel.getByRole('button', { name: 'Duplicate' }),
    canvas(page),
  ]) {
    await page.keyboard.press('Shift+Tab');
    await expect(stop).toBeFocused();
  }
  await expectOptionNames(await openElements(page), [/^Text “Hi”, /u]);
});

test('A5 REQ-Y02 while storage needs attention, the notices’ buttons come between the canvas and Elements', async ({
  context,
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expectSaved(page);
  const second = await context.newPage();
  await openPage(second);
  await canvas(second).focus();
  await second.keyboard.press('o');
  await second.keyboard.press('Enter');
  await expectSaved(second);

  await page.bringToFront();
  await canvas(page).focus();
  await page.keyboard.press('ArrowRight');
  const notices = storageNotices(page);
  const load = notices.getByRole('button', { name: 'Load the newer version' });
  await expect(load).toBeVisible();
  await canvas(page).focus();
  const keep = notices.getByRole('button', { name: 'Keep this version' });
  // Hide is the notices' last control since S7.
  const hide = notices.getByRole('button', { name: 'Hide storage notices' });
  // The rectangle stays selected, so the selection panel's actions come first (S6).
  const panel = page.locator('[data-island="selection"]');
  const duplicate = panel.getByRole('button', { name: 'Duplicate' });
  const remove = panel.getByRole('button', { name: 'Delete' });
  for (const stop of [
    duplicate,
    remove,
    load,
    keep,
    hide,
    elementsToggle(page),
    button(page, 'Undo'),
  ]) {
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
    await expectIndicator(page);
  }
  for (const stop of [elementsToggle(page), hide, keep, load, remove, duplicate, canvas(page)]) {
    await page.keyboard.press('Shift+Tab');
    await expect(stop).toBeFocused();
  }
});

test('E2 C3 REQ-Y02 Undo and Redo keep the focus when they become unavailable', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  const undo = button(page, 'Undo');
  const redo = button(page, 'Redo');
  await undo.focus();
  await page.keyboard.press('Enter');
  await expect(undo).toBeFocused();
  await expect(undo).toBeDisabled();
  await expect(polite(page)).toHaveText('Undid creation of 1 rectangle. Nothing selected.');
  await page.keyboard.press('Tab');
  await expect(redo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(redo).toBeFocused();
  await expect(redo).toBeDisabled();
  await expect(polite(page)).toHaveText('Redid creation of 1 rectangle. 1 element selected.');
});

test('E2 C1 REQ-Y02 answering a second tab’s stale notice leaves the focus on the canvas', async ({
  context,
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expectSaved(page);
  const second = await context.newPage();
  await openPage(second);
  await canvas(second).focus();
  await second.keyboard.press('o');
  await second.keyboard.press('Enter');
  await expectSaved(second);

  await page.bringToFront();
  await canvas(page).focus();
  await page.keyboard.press('ArrowRight');
  const keep = storageNotices(page).getByRole('button', { name: 'Keep this version' });
  await keep.focus();
  await page.keyboard.press('Enter');
  await expect(canvas(page)).toBeFocused();
  await expectSaved(page);

  await second.bringToFront();
  await canvas(second).focus();
  await second.keyboard.press('ArrowLeft');
  const load = storageNotices(second).getByRole('button', { name: 'Load the newer version' });
  await load.focus();
  await second.keyboard.press('Enter');
  await expect(canvas(second)).toBeFocused();
  await expectSaved(second);
  await expectOptionNames(await openElements(second), [/^Rectangle, /u]);
});
