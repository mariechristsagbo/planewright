import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { canvas } from './support.ts';
import { textArea } from './text.ts';

// What the text-editing chrome's end-to-end tests read and drive (the v0.2 plan's S9): the hint
// chip, the phone's Done bar, a session opened from the keyboard, and an emulated on-screen
// keyboard. Page code is written as strings, since these files compile without the DOM library.

/** The text area's hint chip, outside a phone in portrait. */
export const hintChip = (page: Page): Locator => page.locator('#text-editor-hint');

/** The phone's Done bar, by its island, and its one button. */
export const doneBar = (page: Page): Locator => page.locator('[data-island="done"]');
export const doneButton = (page: Page): Locator => page.getByRole('button', { name: 'Done' });

/** Opens a new text at the canvas's centre from the keyboard, as Enter with the Text tool does. */
export async function startSession(page: Page): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('t');
  await page.keyboard.press('Enter');
  await expect(textArea(page)).toBeFocused();
}

/**
 * Taps Done until the session ends, for at most 10 s: under load a tap is lost now and then, and a
 * lost tap leaves the session open, so the tap is repeated only while the text area exists, and each
 * repeat is noted on the test's report as a lost tap, as text-phone.spec.ts does.
 */
export async function tapDone(page: Page): Promise<void> {
  let runs = 0;
  await expect(async () => {
    if ((await textArea(page).count()) === 1) {
      runs += 1;
      if (runs > 1) test.info().annotations.push({ type: 'lost tap', description: 'repeated' });
      await doneButton(page).tap();
    }
    await expect(textArea(page)).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

/**
 * Gives the window's visual viewport own height and offsetTop getters that the test then moves, as
 * an on-screen keyboard would, telling its listeners by a resize or a scroll event; the layout
 * viewport, the canvas and the page stay as they are.
 */
export async function emulateKeyboard(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    const viewport = window.visualViewport;
    window.__keyboard = { height: viewport.height, offsetTop: viewport.offsetTop };
    Object.defineProperty(viewport, 'height', { configurable: true, get: () => window.__keyboard.height });
    Object.defineProperty(viewport, 'offsetTop', { configurable: true, get: () => window.__keyboard.offsetTop });
  })()`);
}

/** Moves the emulated visual viewport and dispatches `type` on it. */
export async function moveKeyboard(
  page: Page,
  heights: { readonly height: number; readonly offsetTop: number },
  type: 'resize' | 'scroll',
): Promise<void> {
  await page.evaluate(
    `(() => { Object.assign(window.__keyboard, ${JSON.stringify(heights)}); window.visualViewport.dispatchEvent(new Event('${type}')); })()`,
  );
}

/** Sets the bottom safe-area inset that the shell reads, as safe-areas.spec.ts emulates it. */
export async function emulateBottomInset(page: Page, inset: number): Promise<void> {
  await page.evaluate(
    `document.documentElement.style.setProperty('--shell-safe-bottom', '${String(inset)}px')`,
  );
}

/** The bottom edge of a laid-out element, in page pixels. */
export async function bottomOf(element: Locator): Promise<number> {
  const box = await element.boundingBox();
  if (box === null) throw new Error('The element is not laid out.');
  return box.y + box.height;
}

/** The document's and the body's scroll sizes, and where the window is after scrolling to 100. */
export const SCROLL = `(() => {
  window.scrollTo(0, 100);
  document.body.scrollTop = 100;
  const { documentElement: html, body } = document;
  return [html.scrollWidth, html.scrollHeight, body.scrollWidth, body.scrollHeight, window.scrollY, body.scrollTop];
})()`;
