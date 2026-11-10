import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { button, elementList, openPage, polite } from './a11y.ts';
import { expectInk, toolButton } from './drawing.ts';
import { canvas, canvasBox } from './support.ts';

// The whole drawing from the keyboard alone (ENG-14, docs/architecture/engine/quality.md#accessibility):
// each P0 kind created with Enter at the centre of the canvas, then selected, nudged and deleted from
// the element list, undone and redone, each step read from the polite live region (REQ-Y02,
// REQ-Y04, REQ-Y05). Nothing here uses the mouse.

/** Presses keys in turn, then waits for the live region to say the message. */
async function step(page: Page, keys: readonly string[], said: string | RegExp): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText(said);
}

/** The x and y of an option's name, "…, at x, y". */
async function placeOf(option: Locator): Promise<number[]> {
  const name = (await option.textContent()) ?? '';
  return (/, at (-?[\d.]+), (-?[\d.]+)$/u.exec(name) ?? []).slice(1).map(Number);
}

test('E1 A1 A2 A3 A4 A5 A6 REQ-Y04 REQ-Y05 every P0 kind made, selected, nudged and deleted from the list, undone and redone, from the keyboard alone', async ({
  page,
}) => {
  await openPage(page);
  await page.keyboard.press('Tab');
  await expect(button(page, 'Pre-release')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(toolButton(page, 'Hand')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await expect(canvas(page)).toBeFocused();
  await step(page, ['Enter'], 'Rectangle created. 1 element selected.');
  await step(page, ['o'], 'Nothing selected.');
  await step(page, ['Enter'], 'Ellipse created. 1 element selected.');
  await step(page, ['d', 'Enter'], 'Diamond created. 1 element selected.');
  await step(page, ['l', 'Enter'], 'Line created. 1 element selected.');
  await step(page, ['p', 'Enter'], 'Freehand stroke created. Nothing selected.');
  await page.keyboard.press('t');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Text' })).toBeFocused();
  await page.keyboard.type('Plan');
  await step(page, ['Escape'], 'Text created. 1 element selected.');
  await expect(canvas(page)).toBeFocused();

  const list = elementList(page);
  const options = list.getByRole('option');
  await expect(options).toHaveText([
    /^Text “Plan”, [\d.]+ by 25, at /u,
    /^Freehand stroke, 0 by 0, at /u,
    /^Line, 100 by 0, at /u,
    /^Diamond, 100 by 100, at /u,
    /^Ellipse, 100 by 100, at /u,
    /^Rectangle, 100 by 100, at /u,
  ]);
  const { width, height } = await canvasBox(page);
  await expectInk(page, [[width / 2 - 30, height / 2]]);

  await page.keyboard.press('Tab');
  await expect(list).toBeFocused();
  const rectangle = options.last();
  const ellipse = options.nth(4);
  const [x = 0, y = 0] = await placeOf(rectangle);
  await step(page, ['End', 'Enter'], '1 element selected.');
  await expect(rectangle).toHaveAttribute('aria-selected', 'true');
  await step(page, ['ArrowUp', ' '], '2 elements selected.');
  await expect(ellipse).toHaveAttribute('aria-selected', 'true');
  await step(page, ['Alt+ArrowRight'], 'Nudged 2 elements. 2 elements selected.');
  await step(page, ['Alt+Shift+ArrowDown'], 'Nudged 2 elements. 2 elements selected.');
  expect(await placeOf(rectangle)).toEqual([x + 1, y + 10]);
  expect(await placeOf(ellipse)).toEqual([x + 1, y + 10]);
  await step(page, ['Delete'], 'Deleted 2 elements. Nothing selected.');
  await expect(options).toHaveCount(4);
  await expect(list).toBeFocused();

  await step(page, ['Control+z'], 'Undid deletion of 2 elements. 2 elements selected.');
  await expect(options).toHaveCount(6);
  await step(page, ['Control+Shift+z'], 'Redid deletion of 2 elements. Nothing selected.');
  await expect(options).toHaveCount(4);
  await page.keyboard.press('Tab');
  await expect(button(page, 'Undo')).toBeFocused();
  await step(page, ['Enter'], 'Undid deletion of 2 elements. 2 elements selected.');
  await step(page, ['Enter'], 'Undid nudge of 2 elements. 2 elements selected.');
  await page.keyboard.press('Tab');
  await expect(button(page, 'Redo')).toBeFocused();
  await step(page, ['Enter'], 'Redid nudge of 2 elements. 2 elements selected.');
  expect(await placeOf(options.last())).toEqual([x + 1, y + 10]);
  expect(await page.evaluate('document.activeElement === document.body')).toBe(false);
});
