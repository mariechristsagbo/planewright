import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { button, elementList, elementsToggle, openElements, openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { canvas } from './support.ts';

// The Elements drawer on a phone in portrait (ADR 0012, decisions 2 and 14; the v0.2 plan's S5,
// issue #66's D5): a sheet along the window's bottom, at most 62 % of its height, whose list
// scrolls inside it. While it is open the palette, which S8 makes the phone's dock, and the bottom
// islands it covers are inert, and Escape closes it with the focus back on the toggle.

const HEIGHT = 844;
test.use({ viewport: { width: 390, height: HEIGHT }, isMobile: true, hasTouch: true });

/** The islands whose controls are inert, by name. */
const INERT = `[...document.querySelectorAll('[inert]')].map((element) => element.closest('[data-island]')?.dataset.island ?? element.id)`;

/** Draws rectangles with Enter at the centre of the canvas, from the keyboard. */
async function draw(page: Page, count: number): Promise<void> {
  await canvas(page).focus();
  for (let made = 0; made < count; made += 1) {
    await page.keyboard.press('r');
    await page.keyboard.press('Enter');
  }
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
}

/** A tap at the middle of a control, with no wait for it to take presses, as a finger gives. */
async function tapAt(page: Page, control: Locator): Promise<void> {
  const box = await control.boundingBox();
  if (box === null) throw new Error('The control is not laid out.');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('D5 A8 the open drawer is a sheet along the bottom, at most 62 % of the height, whose list scrolls inside it', async ({
  page,
}) => {
  await openPage(page);
  await draw(page, 40);
  const list = await openElements(page);
  await expect(list).toBeFocused();
  await expect(list.getByRole('option')).toHaveCount(40);
  const sheet = await page.locator('#element-list-drawer').boundingBox();
  expect(sheet).not.toBeNull();
  const { x = -1, y = -1, width = 0, height = 0 } = sheet ?? {};
  expect([x, width, y + height]).toEqual([0, 390, HEIGHT]);
  expect(height).toBeLessThanOrEqual(0.62 * HEIGHT + 0.5);
  expect(height).toBeGreaterThan(0.6 * HEIGHT);
  const scrolls = await page.evaluate<boolean>(
    "(() => { const list = document.querySelector('[role=listbox]'); return list.scrollHeight > list.clientHeight; })()",
  );
  expect(scrolls).toBe(true);
  await expect(button(page, 'Close Elements')).toBeInViewport({ ratio: 1 });
});

test('D5 A8 the sheet makes the dock and the bottom islands inert, and Escape closes it with the focus on the toggle', async ({
  page,
}) => {
  await openPage(page);
  await draw(page, 2);
  expect(await page.evaluate<string[]>(INERT)).toEqual([]);
  await openElements(page);
  expect(await page.evaluate<string[]>(INERT)).toEqual(['tools', 'bottom-left', 'bottom-right']);
  // A tap on the inert palette chooses no tool and reaches its island, never the canvas; like a
  // tap on any island's padding, it takes the focus from the list.
  await tapAt(page, toolButton(page, 'Ellipse'));
  await expect(toolButton(page, 'Ellipse')).toHaveAttribute('aria-pressed', 'false');
  await expect(toolButton(page, 'Selection')).toHaveAttribute('aria-pressed', 'true');
  await expect(elementList(page).getByRole('option')).toHaveCount(2);
  await elementList(page).focus();
  // Escape closes the sheet and goes no further: the selection stays.
  await page.keyboard.press('Escape');
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(elementsToggle(page)).toBeFocused();
  await expect(elementList(page)).toHaveCount(0);
  expect(await page.evaluate<string[]>(INERT)).toEqual([]);
  const options = (await openElements(page)).getByRole('option');
  await expect(options.and(page.locator('[aria-selected="true"]'))).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(elementsToggle(page)).toBeFocused();
  await tapAt(page, toolButton(page, 'Ellipse'));
  await expect(toolButton(page, 'Ellipse')).toHaveAttribute('aria-pressed', 'true');
});

test('D5 A8 Close and the toggle close the sheet too, with the focus on the toggle', async ({
  page,
}) => {
  await openPage(page);
  await openElements(page);
  await button(page, 'Close Elements').tap();
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(elementsToggle(page)).toBeFocused();
  await openElements(page);
  await expect(elementList(page)).toBeFocused();
  await elementsToggle(page).tap();
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(elementsToggle(page)).toBeFocused();
  expect(await page.evaluate<string[]>(INERT)).toEqual([]);
});

test.describe('in a landscape window, 844 × 390', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('D5 the drawer stays a 280 px side drawer that makes nothing inert, and Escape reaches the editor', async ({
    page,
  }) => {
    await openPage(page);
    await draw(page, 1);
    await openElements(page);
    expect((await page.locator('#element-list-drawer').boundingBox())?.width).toBe(280);
    expect(await page.evaluate<string[]>(INERT)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(polite(page)).toHaveText('Nothing selected.');
    await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'true');
  });
});
