import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { polite } from './a11y.ts';
import { canvas } from './support.ts';

// What the selection panel's end-to-end tests read and drive (the v0.2 plan's S6): the panel or the
// phone's bar, found by its island rather than by a class, its figures, and elements drawn from
// the keyboard. Page code is written as strings, since these files compile without the DOM library.

/** The selection panel or the phone's bar, by its island. */
export const selectionSurface = (page: Page): Locator => page.locator('[data-island="selection"]');

/** A button of the selection panel or bar, by its exact name. */
export const panelButton = (page: Page, name: string): Locator =>
  selectionSurface(page).getByRole('button', { name, exact: true });

/** The figures that an element shows, as term and value, the short terms as shown. */
const FIGURES = (
  selector: string,
) => `[...document.querySelectorAll('${selector} dl > div')].map((pair) => [
  (pair.querySelector('dt [aria-hidden="true"]') ?? pair.querySelector('dt')).textContent,
  pair.querySelector('dd').textContent,
])`;

/** The panel's figures, or the Details sheet's, as [term, value] pairs. */
export const figuresIn = (
  page: Page,
  selector = '[data-island="selection"]',
): Promise<string[][]> => page.evaluate<string[][]>(FIGURES(selector));

/** Focuses the canvas and presses keys in turn, then waits for the polite region to say a message. */
export async function onCanvas(page: Page, keys: readonly string[], said: string | RegExp) {
  await canvas(page).focus();
  for (const key of keys) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText(said);
}

/** Draws a text of these words from the keyboard, at the canvas's centre, and leaves it selected. */
export async function drawText(page: Page, words: readonly string[]): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('t');
  await page.keyboard.press('Enter');
  const area = page.getByRole('textbox', { name: 'Text' });
  await expect(area).toBeFocused();
  for (const [index, line] of words.entries()) {
    if (index > 0) await page.keyboard.press('Enter');
    await page.keyboard.type(line);
  }
  await page.keyboard.press('Escape');
  await expect(polite(page)).toHaveText(/^Text created\. 1 element selected\.$/u);
}

/** The box of a laid-out element. */
export async function boxOf(
  element: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await element.boundingBox();
  if (box === null) throw new Error('The element is not laid out.');
  return box;
}
