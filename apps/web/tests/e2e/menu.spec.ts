import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { button, elementList, elementsToggle, expectIndicator, openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { settled } from './motion.ts';
import { canvas, readout } from './support.ts';

// The identity island's menu (ADR 0012, decisions 2, 10 and 14; the v0.2 plan's S4): the first tab
// stop opens it on Enter, Space, ArrowDown or a click with the focus on its first item; the arrow
// keys, Home and End move; Enter runs an item and closes it; Escape closes it and gives the focus
// back to the button, and Tab closes it without moving the focus back.

const menuButton = (page: Page): Locator => button(page, 'Planewright menu');
const menuOf = (page: Page): Locator => page.getByRole('menu', { name: 'Planewright menu' });
const item = (page: Page, name: string): Locator =>
  menuOf(page).getByRole(name === 'Show elements' ? 'menuitemcheckbox' : 'menuitem', {
    name,
    exact: true,
  });

/** Tabs to the menu button, the page's first stop, and checks that it is there. */
async function tabToMenu(page: Page): Promise<void> {
  await page.keyboard.press('Tab');
  await expect(menuButton(page)).toBeFocused();
}

test('D1 A2 A8 the first stop opens the menu on Enter, Space, ArrowDown and a click, each with the focus on its first item', async ({
  page,
}) => {
  await openPage(page);
  await tabToMenu(page);
  await expectIndicator(page);
  await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
  for (const key of ['Enter', 'Space', 'ArrowDown']) {
    await page.keyboard.press(key);
    await expect(menuOf(page)).toBeVisible();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(item(page, 'Select all')).toBeFocused();
    await expectIndicator(page);
    await page.keyboard.press('Escape');
    await expect(menuOf(page)).toHaveCount(0);
    await expect(menuButton(page)).toBeFocused();
  }
  await menuButton(page).click();
  await expect(item(page, 'Select all')).toBeFocused();
  await menuButton(page).click();
  await expect(menuOf(page)).toHaveCount(0);
});

test('D6 A2 the arrow keys, Home and End move through the items, and Escape gives the focus back to the button', async ({
  page,
}) => {
  await openPage(page);
  await tabToMenu(page);
  await page.keyboard.press('Enter');
  const steps = [
    ['ArrowDown', 'Zoom to fit'],
    ['ArrowDown', 'Reset zoom'],
    ['ArrowDown', 'Show elements'],
    ['ArrowDown', 'Keyboard shortcuts'],
    ['ArrowDown', 'About this build'],
    ['ArrowDown', 'Source on GitHub'],
    ['ArrowDown', 'Select all'],
    ['ArrowUp', 'Source on GitHub'],
    ['Home', 'Select all'],
    ['End', 'Source on GitHub'],
    ['ArrowUp', 'About this build'],
  ] as const;
  for (const [key, name] of steps) {
    await page.keyboard.press(key);
    await expect(item(page, name)).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(menuOf(page)).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
  await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
});

test('A2 Tab closes the menu without moving the focus back: it goes on to Pre-release', async ({
  page,
}) => {
  await openPage(page);
  await tabToMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(item(page, 'Zoom to fit')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menuOf(page)).toHaveCount(0);
  await expect(button(page, 'Pre-release')).toBeFocused();
  await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Tab');
  await expect(toolButton(page, 'Hand')).toBeFocused();
});

test('A2 a press outside the menu closes it and leaves the focus where the press put it', async ({
  page,
}) => {
  await openPage(page);
  await menuButton(page).click();
  await expect(menuOf(page)).toBeVisible();
  const box = await canvas(page).boundingBox();
  if (box === null) throw new Error('The canvas is not laid out.');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(menuOf(page)).toHaveCount(0);
  await expect(canvas(page)).toBeFocused();
});

test('A2 a press inside the menu, on the hairline between its groups, keeps it open with the focus on its item', async ({
  page,
}) => {
  await openPage(page);
  await menuButton(page).click();
  await expect(item(page, 'Select all')).toBeFocused();
  const rule = menuOf(page).getByRole('separator').first();
  await settled(page);
  const box = await rule.boundingBox();
  if (box === null) throw new Error('The hairline is not laid out.');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(menuOf(page)).toBeVisible();
  await expect(item(page, 'Select all')).toBeFocused();
});

test('A2 the mouse resting on the button of the open menu opens no tip, so a press on Select all under the button runs it', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  for (const key of ['r', 'Enter', 'o', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Ellipse created. 1 element selected.');
  const box = await menuButton(page).boundingBox();
  const middle = await canvas(page).boundingBox();
  if (box === null || middle === null) throw new Error('The menu button is not laid out.');
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.click(x, y);
  await expect(item(page, 'Select all')).toBeFocused();
  // Off the button and back, then a rest twice the tip's delay, timed in the page.
  await page.mouse.move(middle.x + middle.width / 2, middle.y + middle.height / 2);
  await page.mouse.move(x, y);
  await page.evaluate('new Promise((resolve) => setTimeout(resolve, 1000))');
  // The press lands at the top of Select all, under the button, where the button's tip would be.
  const first = await item(page, 'Select all').boundingBox();
  if (first === null) throw new Error('Select all is not laid out.');
  await page.mouse.click(x, first.y + 4);
  await expect(polite(page)).toHaveText('2 elements selected.');
  await expect(menuOf(page)).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
});

test('A3 Enter runs Select all, Zoom to fit and Reset zoom through the registry, closes the menu and gives the focus back to the button', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  for (const key of ['r', 'Enter', 'o', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Ellipse created. 1 element selected.');
  await menuButton(page).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(menuOf(page)).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
  await expect(polite(page)).toHaveText('2 elements selected.');
  // Zoom to fit never zooms past 100%, so each zoom item starts from a view zoomed out a step.
  for (const [steps, name] of [
    [1, 'Zoom to fit'],
    [2, 'Reset zoom'],
  ] as const) {
    await button(page, 'Zoom out').click();
    await expect(readout(page)).not.toHaveText(/, zoom 100%$/u);
    await menuButton(page).focus();
    await page.keyboard.press('Enter');
    for (let step = 0; step < steps; step += 1) await page.keyboard.press('ArrowDown');
    await expect(item(page, name)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menuOf(page)).toHaveCount(0);
    await expect(readout(page)).toHaveText(/, zoom 100%$/u);
    await expect(menuButton(page)).toBeFocused();
  }
});

test('A3 Show elements opens and closes the drawer, checked while it is open', async ({ page }) => {
  await openPage(page);
  await menuButton(page).click();
  const show = item(page, 'Show elements');
  await expect(show).toHaveAttribute('role', 'menuitemcheckbox');
  await expect(show).toHaveAttribute('aria-checked', 'false');
  await show.focus();
  await page.keyboard.press('Enter');
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(elementList(page)).toBeVisible();
  // The drawer's opening takes the focus to its list box, and its closing to the toggle (S5).
  await expect(elementList(page)).toBeFocused();
  await menuButton(page).focus();
  await page.keyboard.press('ArrowDown');
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) await page.keyboard.press(key);
  await expect(show).toBeFocused();
  await expect(show).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(elementList(page)).toBeHidden();
  await expect(elementsToggle(page)).toBeFocused();
});

test('A4 each shortcut shows in JetBrains Mono, hidden from assistive technology, while the name and aria-keyshortcuts carry it', async ({
  page,
}) => {
  await openPage(page);
  await menuButton(page).click();
  for (const [name, keys, aria] of [
    ['Select all', 'Ctrl+A', 'Control+A'],
    ['Zoom to fit', 'Shift+1', 'Shift+1'],
    ['Reset zoom', 'Ctrl+0', 'Control+0'],
  ] as const) {
    const each = item(page, name);
    await expect(each).toHaveAccessibleName(name);
    await expect(each).toHaveAttribute('aria-keyshortcuts', aria);
    const key = each.locator('kbd');
    await expect(key).toHaveText(keys);
    await expect(key).toHaveAttribute('aria-hidden', 'true');
    await expect(key).toBeVisible();
  }
  const fonts = await page.evaluate<string[]>(
    "[...document.querySelectorAll('[role=menu] kbd')].map((key) => getComputedStyle(key).fontFamily)",
  );
  expect(fonts).toHaveLength(3);
  expect(fonts.every((font) => font.startsWith('"Planewright Mono"'))).toBe(true);
});

test('D3 D4 A6 A7 Keyboard shortcuts and About this build open from the menu; each keeps the focus inside and gives it back to the menu button', async ({
  page,
}) => {
  await openPage(page);
  await button(page, 'Pre-release').click();
  const about = page.getByRole('dialog', { name: 'About this build' });
  const fromTag = await about.innerHTML();
  await page.keyboard.press('Escape');
  // The dialog leaves the page with its close event, which gives the focus back after Chromium
  // has; until then it is closed and hidden but still there, so wait for no dialog at all.
  await expect(page.getByRole('dialog', { includeHidden: true })).toHaveCount(0);
  await expect(button(page, 'Pre-release')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  for (const [name, steps] of [
    ['Keyboard shortcuts', 4],
    ['About this build', 5],
  ] as const) {
    await expect(menuButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    for (let step = 0; step < steps; step += 1) await page.keyboard.press('ArrowDown');
    await expect(item(page, name)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menuOf(page)).toHaveCount(0);
    const dialog = page.getByRole('dialog', { name });
    const close = dialog.getByRole('button', { name: 'Close' });
    await expect(close).toBeFocused();
    if (name === 'About this build') expect(await dialog.innerHTML()).toBe(fromTag);
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      await expect(dialog.locator(':focus')).toHaveCount(1);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(menuButton(page)).toBeFocused();
  }
});

test.describe('at 390 × 844, a phone in portrait', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('A2 A10 the open menu lies apart from the dock, and a press on any item, at least 44 px high, reaches the item', async ({
    page,
  }) => {
    await openPage(page);
    await menuButton(page).click();
    await expect(menuOf(page)).toBeVisible();
    await settled(page);
    // Each item's centre, and whether the element there is that item or inside it.
    const hits = await page.evaluate<boolean[]>(`[...document.querySelectorAll('[role^=menuitem]')]
      .map((item) => { const box = item.getBoundingClientRect(); return item.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })`);
    expect(hits).toEqual(Array.from({ length: 7 }, () => true));
    // Every item is at least 44 px high on a phone (S8).
    const heights = await page.evaluate<number[]>(
      `[...document.querySelectorAll('[role^=menuitem]')].map((item) => item.getBoundingClientRect().height)`,
    );
    expect(heights.filter((height) => height < 44)).toEqual([]);
    // The tool bar is the dock at the window's bottom, below the menu (S8).
    const tools = await page.getByRole('toolbar', { name: 'Tools' }).boundingBox();
    const menu = await menuOf(page).boundingBox();
    expect(tools !== null && menu !== null && menu.y + menu.height < tools.y).toBe(true);
  });
});

test.describe('at 568 × 320, a short window', () => {
  test.use({ viewport: { width: 568, height: 320 } });

  test('A2 the menu stays inside the window and its last item scrolls into view', async ({
    page,
  }) => {
    await openPage(page);
    await tabToMenu(page);
    await page.keyboard.press('Enter');
    await settled(page);
    const box = await menuOf(page).boundingBox();
    expect(box !== null && box.y + box.height <= 320 && box.x + box.width <= 568).toBe(true);
    await page.keyboard.press('End');
    await expect(item(page, 'Source on GitHub')).toBeFocused();
    await expect(item(page, 'Source on GitHub')).toBeInViewport({ ratio: 1 });
    await expectIndicator(page);
  });
});
