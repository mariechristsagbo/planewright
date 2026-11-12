import { expect, test } from '@playwright/test';

import { elementList, elementsToggle, openElements, openPage } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { expectPlaced } from './layout.ts';
import { drawText, panelButton, selectionSurface } from './panel.ts';
import { doneBar, doneButton, hintChip, startSession, tapDone } from './session.ts';
import { textArea } from './text.ts';

// The Done bar with the phone's other surfaces (the v0.2 plan's S9, issue #75's D1, D8 to D10): Edit
// text on the selection bar opens a session without the bar and its Details sheet, which Done brings
// back; a session closes the Elements sheet and keeps the text area's focus, Done on top; a window
// that turns with Done focused gives the text area the focus and shows the chip in landscape, and a
// turn back shows Done again; and a phone in landscape shows the chip and no bar. Page code is
// written as strings, since these files compile without the DOM library.

/** The element at the middle of a laid-out element, as its id or tag. */
const TOPMOST = (selector: string) => `(() => {
  const { x, y, width, height } = document.querySelector('${selector}').getBoundingClientRect();
  const top = document.elementFromPoint(x + width / 2, y + height / 2);
  return top.id || top.tagName;
})()`;

for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 360, height: 560 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('D9 A10 Edit text on the selection bar opens a session without the bar and the Details sheet, and Done brings the bar back', async ({
      page,
    }) => {
      await openPage(page);
      await drawText(page, ['Plan']);
      await panelButton(page, 'Details').tap();
      await expect(page.getByRole('region', { name: 'Details' })).toBeVisible();
      await panelButton(page, 'Edit text').tap();
      await expect(textArea(page)).toBeFocused();
      await expect(selectionSurface(page)).toHaveCount(0);
      await expect(page.locator('#details-sheet')).toHaveCount(0);
      await expect(doneButton(page)).toBeVisible();
      await tapDone(page);
      await expect(selectionSurface(page).getByRole('heading', { name: 'Text' })).toBeVisible();
      await expect(panelButton(page, 'Details')).toHaveAttribute('aria-expanded', 'false');
    });

    test('D10 A11 Edit text with the Elements sheet open closes it, the text area keeping the focus, and Done is on top', async ({
      page,
    }) => {
      await openPage(page);
      await drawText(page, ['Plan']);
      await openElements(page);
      await expect(elementList(page)).toBeVisible();
      await panelButton(page, 'Edit text').tap();
      await expect(textArea(page)).toBeFocused();
      await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(elementList(page)).toHaveCount(0);
      expect(await page.evaluate<string>(TOPMOST('[data-island="done"] button'))).toBe(
        'text-editor-done',
      );
      await expectPlaced(page, viewport, 3);
    });

    test('D8 A12 a turn with Done focused gives the text area the focus and shows the chip, and a turn back shows Done and hides the dock', async ({
      page,
    }) => {
      await openPage(page);
      await startSession(page);
      await page.keyboard.type('Turn');
      await page.keyboard.press('Tab');
      await expect(doneButton(page)).toBeFocused();
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await expect(textArea(page)).toBeFocused();
      await expect(hintChip(page)).toBeVisible();
      await expect(doneBar(page)).toHaveCount(0);
      await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
      await page.setViewportSize(viewport);
      await expect(doneButton(page)).toBeVisible();
      await expect(page.locator('[data-island="tools"]')).toBeHidden();
      await expect(textArea(page)).toBeFocused();
      await expect(textArea(page)).toHaveValue('Turn');
    });
  });
}

test.describe('at 844 × 390 with touch', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('D1 A2 A9 a session in landscape shows the chip and no bar, the palette and the bottom row visible', async ({
    page,
  }) => {
    await openPage(page);
    await startSession(page);
    await expect(hintChip(page)).toBeVisible();
    await expect(hintChip(page)).toHaveText('Finish with Esc or Ctrl+Enter');
    await expect(doneBar(page)).toHaveCount(0);
    await expect(toolButton(page, 'Hand')).toBeVisible();
    await expect(page.locator('[data-island="bottom-left"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toBeVisible();
  });
});
