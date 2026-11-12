import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { button, expectIndicator, openPage } from './a11y.ts';
import { settled } from './motion.ts';
import { canvas } from './support.ts';

// The Keyboard shortcuts dialog (ADR 0012, decisions 2 and 14; the v0.2 plan's S4): the button at
// the bottom right, the last tab stop, opens a modal dialog that lists the registry's commands
// with their keys in JetBrains Mono. The focus lands on Close and stays inside; Escape and a press
// on the scrim close it, and the focus goes back to the button. A phone in portrait does not show
// the button (the v0.2 plan's S8), so a window that turns to portrait gives its focus, or the
// dialog's on closing, to the menu button, never to the body.

const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Keyboard shortcuts' });

const PORTRAIT = { width: 390, height: 844 };

for (const [viewport, touch] of [
  [{ width: 844, height: 390 }, true],
  [{ width: 1280, height: 720 }, false],
] as const) {
  test.describe(`turning from ${String(viewport.width)} × ${String(viewport.height)} to portrait`, () => {
    test.use({ viewport, isMobile: touch, hasTouch: touch });

    test('A12 D5 Keyboard shortcuts focused gives the focus to the menu button, with a visible indicator', async ({
      page,
    }) => {
      await openPage(page);
      const opener = button(page, 'Keyboard shortcuts');
      await page.keyboard.press('Shift+Tab');
      await expect(opener).toBeFocused();
      await page.setViewportSize(PORTRAIT);
      await expect(opener).toBeHidden();
      await expect(button(page, 'Planewright menu')).toBeFocused();
      await expectIndicator(page);
    });

    test('A12 D5 the dialog opened from Keyboard shortcuts and closed after the turn gives the focus to the menu button', async ({
      page,
    }) => {
      await openPage(page);
      await button(page, 'Keyboard shortcuts').focus();
      await page.keyboard.press('Enter');
      const close = dialogOf(page).getByRole('button', { name: 'Close' });
      await expect(close).toBeFocused();
      await page.setViewportSize(PORTRAIT);
      await expect(close).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialogOf(page)).toHaveCount(0);
      await expect(button(page, 'Planewright menu')).toBeFocused();
    });
  });
}

test('D3 A6 REQ-Y02 the bottom-right button opens Keyboard shortcuts; the focus stays inside, and Escape gives it back to the button', async ({
  page,
}) => {
  await openPage(page);
  const opener = button(page, 'Keyboard shortcuts');
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = dialogOf(page);
  const close = dialog.getByRole('button', { name: 'Close' });
  await expect(close).toBeFocused();
  await expectIndicator(page);
  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    await expect(close).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('D3 A6 REQ-Y02 a press on the scrim closes Keyboard shortcuts and gives the focus back to the button; a press inside keeps it open', async ({
  page,
}) => {
  await openPage(page);
  const opener = button(page, 'Keyboard shortcuts');
  await opener.click();
  const dialog = dialogOf(page);
  await dialog.getByRole('heading', { name: 'Keyboard shortcuts' }).click();
  await expect(dialog).toBeVisible();
  await settled(page);
  const box = await dialog.boundingBox();
  if (box === null) throw new Error('Keyboard shortcuts is not laid out.');
  await page.mouse.click(Math.max(2, box.x / 2), box.y + box.height / 2);
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('D3 A6 REQ-Y02 closing Keyboard shortcuts gives the focus to its button even when the press that opened it did not focus the button', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.evaluate(
    'document.querySelector(\'[data-island="bottom-right"] [aria-haspopup="dialog"]\').dispatchEvent(new MouseEvent(\'click\', { bubbles: true }))',
  );
  const dialog = dialogOf(page);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button(page, 'Keyboard shortcuts')).toBeFocused();
});

test('D3 A4 lists the commands with their keys in JetBrains Mono, scrolling inside the window', async ({
  page,
}) => {
  await openPage(page);
  await button(page, 'Keyboard shortcuts').click();
  const dialog = dialogOf(page);
  const hand = dialog.getByRole('row', { name: /^Hand\b/u });
  await expect(hand.getByRole('rowheader')).toHaveText('Hand');
  await expect(hand.getByRole('cell')).toHaveText('H');
  await expect(dialog.getByRole('row', { name: /^Undo\b/u }).getByRole('cell')).toHaveText(
    'Ctrl+Z',
  );
  // Every row shows one key or more, each in the keys' face; the unit tests count the rows.
  const rows = await dialog.getByRole('row').count();
  const fonts = await page.evaluate<string[]>(
    "[...document.querySelectorAll('dialog[open] td kbd')].map((key) => getComputedStyle(key).fontFamily)",
  );
  expect(fonts.length).toBeGreaterThanOrEqual(rows);
  expect(fonts.every((font) => font.startsWith('"Planewright Mono"'))).toBe(true);
  await settled(page);
  const box = await dialog.boundingBox();
  const size = page.viewportSize();
  expect(box !== null && size !== null && box.y + box.height <= size.height).toBe(true);
  await expect(dialog.getByRole('row', { name: /^Create at the centre/u })).toBeAttached();
});
