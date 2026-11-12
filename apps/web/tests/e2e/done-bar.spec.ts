import { expect, test } from '@playwright/test';

import { button, expectIndicator, openPage, polite, textContrasts } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { expectPlaced } from './layout.ts';
import { boxOf, selectionSurface } from './panel.ts';
import {
  bottomOf,
  doneBar,
  doneButton,
  emulateBottomInset,
  emulateKeyboard,
  hintChip,
  moveKeyboard,
  SCROLL,
  startSession,
  tapDone,
} from './session.ts';
import { canvas, canvasBox } from './support.ts';
import { expectInkIn, textArea } from './text.ts';

// The phone's Done bar (the v0.2 plan's S9 and responsive rule 5, issue #75's D5 to D9, D11 and
// D13): on a phone in portrait, while a text is edited, a bar along the window's bottom holds Done,
// at least 44 px, 8 px above the window's bottom, the keyboard or the bottom safe-area inset; Done
// commits the text as Escape does; the dock and history and zoom are hidden meanwhile; a press on
// the bar keeps the session; the keyboard's inset moves the bar alone, never the camera, the canvas
// or the text area. The keyboard is emulated through the visual viewport's height and offsetTop,
// and the inset through --shell-safe-bottom, since the emulator has neither. Page code is written
// as strings, since these files compile without the DOM library.

/** The text area's box, the canvas's box and the view's readout, which no keyboard moves. */
const STILL = `(() => {
  const box = (element) => { const { x, y, width, height } = element.getBoundingClientRect(); return [x, y, width, height]; };
  return {
    area: box(document.querySelector('textarea.text-editor')),
    canvas: box(document.querySelector('[aria-label="Drawing canvas"]')),
    readout: document.getElementById('view-readout').textContent,
  };
})()`;

for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 360, height: 560 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('D5 D9 A5 A9 A16 a session shows Done at least 44 px 8 px above the window’s bottom in a full-width bar, the dock and history hidden, and no chip', async ({
      page,
    }) => {
      await openPage(page);
      await startSession(page);
      const bar = await boxOf(doneBar(page));
      expect([bar.x, bar.width, bar.y + bar.height]).toEqual([0, viewport.width, viewport.height]);
      const done = await boxOf(doneButton(page));
      expect(Math.min(done.width, done.height)).toBeGreaterThanOrEqual(44);
      expect([done.x + done.width, done.y + done.height]).toEqual([
        viewport.width - 8,
        viewport.height - 8,
      ]);
      await expect(page.locator('[data-island="tools"]')).toBeHidden();
      await expect(page.locator('[data-island="bottom-left"]')).toBeHidden();
      await expect(page.getByRole('toolbar', { name: 'Tools' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
      await expect(page.locator('[data-island="identity"]')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Elements/u })).toBeVisible();
      await expect(hintChip(page)).toHaveCount(0);
      await expectPlaced(page, viewport, 3);
      const { width, height } = viewport;
      expect(await page.evaluate(SCROLL)).toEqual([width, height, width, height, 0, 0]);
    });

    test('D7 A6 a tap on Done draws the text, focuses the canvas, says so, and brings back the dock, history and the selection bar, with one undo step', async ({
      page,
    }) => {
      await openPage(page);
      await startSession(page);
      await page.keyboard.type('Plan');
      const area = await boxOf(textArea(page));
      const box = await canvasBox(page);
      await tapDone(page);
      await expect(canvas(page)).toBeFocused();
      await expect(polite(page)).toHaveText('Text created. 1 element selected.');
      const ink = [area.x - box.x, area.y - box.y, 30, area.height] as const;
      await expectInkIn(page, ink);
      await expect(doneBar(page)).toHaveCount(0);
      await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
      await expect(selectionSurface(page).getByRole('heading', { name: 'Text' })).toBeVisible();
      const undo = page.getByRole('button', { name: 'Undo' });
      await expect(undo).toBeVisible();
      await expect(async () => {
        await undo.tap();
        await expectInkIn(page, ink, false);
      }).toPass();
      await expect(undo).toHaveAttribute('aria-disabled', 'true');
    });

    test('D6 D11 A7 A13 the bar sits on the keyboard’s inset as it moves, while the readout, the canvas and the text area stay', async ({
      page,
    }) => {
      await openPage(page);
      await startSession(page);
      await emulateKeyboard(page);
      const still = await page.evaluate(STILL);
      const { height } = viewport;
      await moveKeyboard(page, { height: height - 336, offsetTop: 0 }, 'resize');
      expect(await bottomOf(doneBar(page))).toBe(height - 336);
      expect(await bottomOf(doneButton(page))).toBe(height - 344);
      await moveKeyboard(page, { height: height - 444, offsetTop: 100 }, 'scroll');
      expect(await bottomOf(doneBar(page))).toBe(height - 344);
      expect(await page.evaluate(STILL)).toEqual(still);
      await moveKeyboard(page, { height, offsetTop: 0 }, 'resize');
      expect(await bottomOf(doneBar(page))).toBe(height);
      expect(await page.evaluate(STILL)).toEqual(still);
      await expect(textArea(page)).toBeFocused();
      expect(await page.evaluate<number>('window.scrollY + document.body.scrollTop')).toBe(0);
    });

    test('D5 A8 Done sits 8 px above the bottom safe-area inset with no keyboard, and 8 px above the keyboard, which covers the inset', async ({
      page,
    }) => {
      await openPage(page);
      await emulateBottomInset(page, 34);
      await startSession(page);
      await emulateKeyboard(page);
      const { height } = viewport;
      expect(await bottomOf(doneButton(page))).toBe(height - 42);
      await moveKeyboard(page, { height: height - 336, offsetTop: 0 }, 'resize');
      expect(await bottomOf(doneButton(page))).toBe(height - 344);
    });

    test('D7 A15 a tap on the bar’s padding keeps the session and the text area’s focus, and reaches no canvas', async ({
      page,
    }) => {
      await openPage(page);
      await startSession(page);
      await page.keyboard.type('Plan');
      const bar = await boxOf(doneBar(page));
      await page.touchscreen.tap(12, bar.y + bar.height / 2);
      await page.waitForTimeout(350);
      await expect(textArea(page)).toBeFocused();
      await expect(textArea(page)).toHaveValue('Plan');
      await expect(doneBar(page)).toBeVisible();
    });

    test('D8 A12 Tab reaches Done with the session open and Shift+Tab goes back; Enter on Done commits; Tab past Done reaches Elements and commits', async ({
      page,
    }) => {
      await openPage(page);
      await startSession(page);
      await page.keyboard.type('Hi');
      await page.keyboard.press('Tab');
      await expect(doneButton(page)).toBeFocused();
      await expectIndicator(page);
      await expect(textArea(page)).toHaveCount(1);
      await page.keyboard.press('Shift+Tab');
      await expect(textArea(page)).toBeFocused();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(textArea(page)).toHaveCount(0);
      await expect(canvas(page)).toBeFocused();
      await startSession(page);
      await page.keyboard.type('Two');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: /^Elements/u })).toBeFocused();
      await expect(textArea(page)).toHaveCount(0);
      await expect(doneBar(page)).toHaveCount(0);
    });

    test('A15 Done’s word meets 4.5:1, and nothing animates', async ({ page }) => {
      await openPage(page);
      await startSession(page);
      const done = (await textContrasts(page)).filter(({ text }) => text === 'Done');
      expect(done).toHaveLength(1);
      expect(done[0]?.ratio).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate<number>('document.getAnimations().length')).toBe(0);
    });

    test('A18 after a reload there is no bar and the dock shows', async ({ page }) => {
      await openPage(page);
      await startSession(page);
      await expect(doneBar(page)).toBeVisible();
      await page.reload();
      await expect(canvas(page)).toBeVisible();
      await expect(doneBar(page)).toHaveCount(0);
      await expect(toolButton(page, 'Text')).toBeVisible();
      await expect(button(page, 'Undo')).toBeVisible();
    });
  });
}
