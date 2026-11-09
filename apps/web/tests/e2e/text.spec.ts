import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { mouseClick, mouseDrag, overlayInk, toolButton } from './drawing.ts';
import type { Point } from './drawing.ts';
import { canvas, canvasBox } from './support.ts';
import { expectInkIn, expectTextAreaAt, inkAround, textArea } from './text.ts';

// The Text tool and text editing on the desktop (ENG-12), with the mouse and the keyboard. A text
// placed at (300,150) and typed "Hello" is drawn in [300,137.5,~45,25]; nothing is drawn left of it.

const HELLO = [300, 137, 40, 26] as const;
const LEFT_OF_IT = [260, 137, 38, 26] as const;
const PAST_HELLO = [352, 137, 50, 26] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await canvas(page).focus();
});

/** Chooses the Text tool, clicks at (300,150) and types the text. */
async function place(page: Page, text: string): Promise<void> {
  await toolButton(page, 'Text').click();
  await mouseClick(page, [300, 150]);
  await expectTextAreaAt(page, [300, 150]);
  await page.keyboard.type(text);
}

test('E1 A1 A2 A3 REQ-C09 a click shows the text area at B-06’s placement, and Escape draws the typed text', async ({
  page,
}) => {
  await place(page, 'Hello');
  await expect(textArea(page)).toHaveValue('Hello');
  await expectInkIn(page, HELLO, false);
  await page.keyboard.press('Escape');
  await expect(textArea(page)).toHaveCount(0);
  await expectInkIn(page, HELLO);
  await expectInkIn(page, LEFT_OF_IT, false);
  await expect(toolButton(page, 'Selection')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('E2 A4 A5 A6 Mod+Enter, a press outside and a tool change each commit', async ({ page }) => {
  await place(page, 'Hello');
  await page.keyboard.press('Control+Enter');
  await expect(textArea(page)).toHaveCount(0);
  await expectInkIn(page, HELLO);

  await toolButton(page, 'Text').click();
  await mouseClick(page, [300, 250]);
  await expectTextAreaAt(page, [300, 250]);
  await page.keyboard.type('Two');
  await mouseClick(page, [600, 350]);
  await expect(textArea(page)).toHaveCount(0);
  await expectInkIn(page, [300, 237, 30, 26]);

  await toolButton(page, 'Text').click();
  await mouseClick(page, [600, 150]);
  await expectTextAreaAt(page, [600, 150]);
  await page.keyboard.type('Three');
  await toolButton(page, 'Rectangle').click();
  await expect(textArea(page)).toHaveCount(0);
  await expectInkIn(page, [600, 137, 40, 26]);
  await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'true');
});

test('E3 A7 A8 REQ-C10 an empty new text leaves no undo step, and one session is one undo step', async ({
  page,
}) => {
  await place(page, '');
  await page.keyboard.press('Escape');
  await expect(textArea(page)).toHaveCount(0);
  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();

  await place(page, 'Hello');
  await page.keyboard.press('Escape');
  await expectInkIn(page, HELLO);
  await undo.click();
  await expectInkIn(page, HELLO, false);
  await expect(undo).toBeDisabled();
  await redo.click();
  await expectInkIn(page, HELLO);
});

test('E4 A9 REQ-C10 a double-click on a text edits it again, as one undo step', async ({
  page,
}) => {
  await place(page, 'Hello');
  await page.keyboard.press('Escape');
  await expectInkIn(page, HELLO);
  const box = await canvasBox(page);
  await page.mouse.dblclick(box.x + 315, box.y + 150);
  await expect(textArea(page)).toBeFocused();
  await expect(textArea(page)).toHaveValue('Hello');
  await page.keyboard.press('End');
  await page.keyboard.type(' world');
  await page.keyboard.press('Escape');
  await expect(textArea(page)).toHaveCount(0);
  await expectInkIn(page, PAST_HELLO);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expectInkIn(page, PAST_HELLO, false);
  await expectInkIn(page, HELLO);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('E5 A10 shortcut letters typed into the text area go into the text and leave the tool unchanged', async ({
  page,
}) => {
  await place(page, 'rvh1');
  await page.keyboard.press('Delete');
  await expect(textArea(page)).toHaveValue('rvh1');
  await expect(toolButton(page, 'Text')).toHaveAttribute('aria-pressed', 'true');
  await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await expect(textArea(page)).toHaveCount(0);
});

test('D4 a rotated text is edited where the canvas draws it: the text area’s glyphs lie within 1 px of the drawn ones', async ({
  page,
}) => {
  await place(page, 'Hello');
  // The text's box is the text area less the caret's room, one font size: 20 px at zoom 1.
  const width = ((await textArea(page).boundingBox())?.width ?? 0) - 20;
  await page.keyboard.press('Escape');
  await expectInkIn(page, HELLO);
  const centre: Point = [300 + width / 2, 150];
  // A quarter turn clockwise by the rotation handle, 24 px above the selected text's top centre.
  await mouseDrag(page, [centre[0], 137.5 - 24], [centre[0] + 80, centre[1]]);
  await mouseClick(page, [600, 350]);
  await expect.poll(() => overlayInk(page)).toBe(0);
  await expect
    .poll(async () => {
      const { left, top, right, bottom } = await inkAround(page, centre, 60);
      return bottom - top > 2 * (right - left);
    })
    .toBe(true);
  const drawn = await inkAround(page, centre, 60);

  const box = await canvasBox(page);
  await page.mouse.dblclick(box.x + centre[0], box.y + centre[1]);
  await expect(textArea(page)).toBeFocused();
  await expect(textArea(page)).toHaveValue('Hello');
  await expectInkIn(page, [centre[0] - 30, centre[1] - 30, 60, 60], false);
  const edited = await inkAround(page, centre, 60);
  const offsets = Object.fromEntries(
    (['left', 'top', 'right', 'bottom', 'x', 'y'] as const).map((side) => [
      side,
      edited[side] - drawn[side],
    ]),
  );
  test.info().annotations.push({ type: 'ink offsets', description: JSON.stringify(offsets) });
  expect(
    Object.values(offsets).every((offset) => Math.abs(offset) <= 1),
    JSON.stringify(offsets),
  ).toBe(true);
});
