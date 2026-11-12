import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { button, openPage, textContrasts } from './a11y.ts';
import { mouseClick, toolButton } from './drawing.ts';
import type { Point } from './drawing.ts';
import { doneButton, hintChip } from './session.ts';
import { canvas, canvasBox, cameraOf } from './support.ts';
import { expectTextAreaAt, textArea } from './text.ts';

// The text area's hint chip (the v0.2 plan's S9, issue #75's D1 to D4): outside a phone in portrait,
// while a text is edited, a caption 8 px under the text area at its left names the keys that end the
// session in Planewright UI, its keys in Planewright Mono, and describes the text area; it follows a
// new line and a zoom, goes when the session ends by any way, lets a press through to the canvas,
// meets 4.5:1 and does not move; and nothing else of the chrome changes. Page code is written as
// strings, since these files compile without the DOM library.

const SENTENCE = 'Finish with Esc or Ctrl+Enter';

/** The chip's and the text area's boxes, and the chip's and its first key's computed families. */
const PLACE = `(() => {
  const box = (element) => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, bottom: y + height, width }; };
  const chip = document.getElementById('text-editor-hint');
  return {
    chip: box(chip),
    area: box(document.querySelector('textarea.text-editor')),
    words: getComputedStyle(chip).fontFamily,
    keys: getComputedStyle(chip.querySelector('kbd')).fontFamily,
  };
})()`;

interface Place {
  readonly chip: { x: number; y: number; bottom: number; width: number };
  readonly area: { x: number; y: number; bottom: number; width: number };
  readonly words: string;
  readonly keys: string;
}

/** Chooses the Text tool, clicks at (300, 150) and types the text. */
async function place(page: Page, text: string): Promise<void> {
  await canvas(page).focus();
  await toolButton(page, 'Text').click();
  await mouseClick(page, [300, 150]);
  await expectTextAreaAt(page, [300, 150]);
  await page.keyboard.type(text);
}

/** The chip's top lies 8 ± 1 px under the text area's box, and its left within 1 px of the box's. */
async function expectUnder(page: Page): Promise<Place> {
  const at = await page.evaluate<Place>(PLACE);
  expect(Math.abs(at.chip.y - at.area.bottom - 8)).toBeLessThanOrEqual(1);
  expect(Math.abs(at.chip.x - at.area.x)).toBeLessThanOrEqual(1);
  return at;
}

const POINT: Point = [500, 250];

for (const [viewport, touch] of [
  [{ width: 1440, height: 900 }, false],
  [{ width: 800, height: 720 }, false],
  [{ width: 844, height: 390 }, true],
] as const) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}${touch ? ' with touch' : ''}`, () => {
    test.use({ viewport, isMobile: touch, hasTouch: touch });

    test('D2 D3 A2 A3 the chip lies 8 px under the text area at its left, its words in Planewright UI and keys in Planewright Mono, and describes it', async ({
      page,
    }) => {
      await openPage(page);
      await place(page, 'Hello');
      await expect(hintChip(page)).toBeVisible();
      await expect(hintChip(page)).toHaveText(SENTENCE);
      const at = await expectUnder(page);
      expect(at.words).toMatch(/^"Planewright UI", /u);
      expect(at.keys).toMatch(/^"Planewright Mono", /u);
      await expect(textArea(page)).toHaveAccessibleDescription(SENTENCE);
      await expect(textArea(page)).toHaveAccessibleName('Text');
    });

    test('D3 A3 the chip moves 25 px down with a second line, and stays 8 px under the text area through a Ctrl+wheel zoom', async ({
      page,
    }) => {
      await openPage(page);
      await place(page, 'Hello');
      const first = await expectUnder(page);
      await page.keyboard.press('Enter');
      await page.keyboard.type('World');
      const second = await expectUnder(page);
      expect(Math.abs(second.chip.y - first.chip.y - 25)).toBeLessThanOrEqual(0.5);
      const box = await canvasBox(page);
      await page.mouse.move(box.x + POINT[0], box.y + POINT[1]);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -200);
      await page.keyboard.up('Control');
      await expect.poll(async () => (await cameraOf(page)).zoom).toBeGreaterThan(1);
      await expect(textArea(page)).toBeFocused();
      await expect
        .poll(async () => (await page.evaluate<Place>(PLACE)).area.width)
        .not.toBe(second.area.width);
      await expectUnder(page);
    });

    test('A4 the chip goes when Escape, Ctrl+Enter, a press elsewhere or a tool from the palette ends the session', async ({
      page,
    }) => {
      await openPage(page);
      const ends: [string, () => Promise<void>][] = [
        ['Escape', () => page.keyboard.press('Escape')],
        ['Ctrl+Enter', () => page.keyboard.press('Control+Enter')],
        ['a press elsewhere', () => mouseClick(page, POINT)],
        ['a tool', () => toolButton(page, 'Rectangle').click()],
      ];
      for (const [name, end] of ends) {
        await place(page, 'Hi');
        await expect(hintChip(page), name).toBeVisible();
        await end();
        await expect(textArea(page), name).toHaveCount(0);
        await expect(hintChip(page), name).toHaveCount(0);
      }
    });

    test('A4 REQ-C11 a click at the chip’s middle reaches the canvas, which ends the session and takes the focus', async ({
      page,
    }) => {
      await openPage(page);
      await place(page, 'Hi');
      const chip = await hintChip(page).boundingBox();
      if (chip === null) throw new Error('No chip.');
      await page.mouse.click(chip.x + chip.width / 2, chip.y + chip.height / 2);
      await expect(textArea(page)).toHaveCount(0);
      await expect(hintChip(page)).toHaveCount(0);
      await expect(canvas(page)).toBeFocused();
    });

    test('D1 A9 nothing else changes: no Done, and the palette and Undo stay shown', async ({
      page,
    }) => {
      await openPage(page);
      await place(page, 'Hi');
      await expect(doneButton(page)).toHaveCount(0);
      await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
      await expect(button(page, 'Undo')).toBeVisible();
      await expect(button(page, 'Undo')).toHaveAttribute('aria-disabled', 'true');
    });

    test('D4 A15 the chip’s words and keys meet 4.5:1, and nothing animates', async ({ page }) => {
      await openPage(page);
      await place(page, 'Hi');
      const texts = (await textContrasts(page)).filter(({ text }) =>
        ['Finish with  or', 'Esc', 'Ctrl+Enter'].includes(text),
      );
      expect(texts.map(({ text }) => text)).toEqual(['Finish with  or', 'Esc', 'Ctrl+Enter']);
      expect(texts.map(({ ratio }) => ratio)).toEqual([8.16, 15.48, 15.48]);
      expect(await page.evaluate<number>('document.getAnimations().length')).toBe(0);
    });
  });
}
