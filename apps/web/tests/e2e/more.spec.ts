import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { expectIndicator, openPage, polite } from './a11y.ts';
import { expectInk, moreButton, toolButton, touch } from './drawing.ts';
import { settled } from './motion.ts';
import { canvas, cameraOf, expectHistoryDisabled } from './support.ts';

// More on the phone's dock (ADR 0012, decisions 2, 13 and 14; the v0.2 plan's S8, issue #73's A3,
// A4, A12 to A14): a tap opens its popover above the dock, inside the window, whose Hand pans,
// Diamond draws and Tool lock toggles; More shows the active tool's glyph, pressed, while it holds
// that tool; the keyboard reaches and works it with a visible indicator at each stop; a press on
// it creates nothing; and every load starts with it closed. Page code is written as strings, since
// these files compile without the DOM library.

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const group = (page: Page): Locator => page.getByRole('group', { name: 'More' });

/** More's glyph's name and its pressed state. */
async function face(page: Page): Promise<(string | null)[]> {
  const glyph = await moreButton(page).locator('svg').getAttribute('data-glyph');
  return [glyph, await moreButton(page).getAttribute('aria-pressed')];
}

/** Taps More until its popover is open, since a tap after a touch can be lost. */
async function openMore(page: Page): Promise<void> {
  await expect(async () => {
    if ((await moreButton(page).getAttribute('aria-expanded')) !== 'true') {
      await moreButton(page).tap();
    }
    await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass();
}

/** Each of More's items' box, and whether the element at its centre is that item or inside it. */
const ITEMS = `[...document.querySelectorAll('#more-tools button')].map((item) => {
  const box = item.getBoundingClientRect();
  return { width: box.width, height: box.height, top: item.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
})`;

test('A3 A13 a tap on More opens its popover above the dock, right-aligned with More, inside the window, its items 44 px and topmost', async ({
  page,
}) => {
  await openPage(page);
  await openMore(page);
  await settled(page);
  const popover = await group(page).boundingBox();
  const dock = await page.locator('[data-island="tools"]').boundingBox();
  const more = await moreButton(page).boundingBox();
  if (popover === null || dock === null || more === null) throw new Error('Not laid out.');
  expect(popover.y + popover.height).toBeLessThanOrEqual(dock.y);
  expect(Math.abs(popover.x + popover.width - (more.x + more.width))).toBeLessThanOrEqual(1);
  expect(popover.x).toBeGreaterThanOrEqual(8);
  expect(popover.y).toBeGreaterThanOrEqual(8);
  expect(popover.x + popover.width).toBeLessThanOrEqual(390 - 8);
  const items = await page.evaluate<{ width: number; height: number; top: boolean }[]>(ITEMS);
  expect(items).toEqual(Array.from({ length: 3 }, () => expect.objectContaining({ top: true })));
  expect(items.filter(({ width, height }) => width < 44 || height < 44)).toEqual([]);
  await expect(group(page).getByRole('button')).toHaveText(['H', 'D', 'Q']);
});

test('A3 A4 a tap on Diamond closes More, which shows the diamond pressed, and a touch drag draws a diamond', async ({
  page,
}) => {
  await openPage(page);
  await openMore(page);
  await toolButton(page, 'Diamond').tap();
  await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'false');
  expect(await face(page)).toEqual(['diamond', 'true']);
  await touch(page, [100, 250], [200, 350]);
  // A diamond's edge passes the middle of its box's corner's quarter, never the corner.
  await expectInk(page, [[125, 275]]);
  await expectInk(page, [[100, 250]], false);
});

test('A3 A4 More then Hand: More shows the hand pressed and a touch drag pans; Selection gives More back its glyph', async ({
  page,
}) => {
  await openPage(page);
  await openMore(page);
  await toolButton(page, 'Hand').tap();
  expect(await face(page)).toEqual(['hand', 'true']);
  const before = await cameraOf(page);
  await touch(page, [200, 400], [250, 460]);
  await expect.poll(() => cameraOf(page)).not.toEqual(before);
  await toolButton(page, 'Selection').tap();
  await expect(moreButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await face(page)).toEqual(['more', 'false']);
});

test('A3 A4 Tool lock in More toggles its padlock, and More keeps its own glyph', async ({
  page,
}) => {
  await openPage(page);
  await openMore(page);
  await expect(toolButton(page, 'Tool lock').locator('svg')).toHaveAttribute(
    'data-glyph',
    'lock-open',
  );
  await toolButton(page, 'Tool lock').tap();
  await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'false');
  expect(await face(page)).toEqual(['more', 'false']);
  await openMore(page);
  await expect(toolButton(page, 'Tool lock')).toHaveAttribute('aria-pressed', 'true');
  await expect(toolButton(page, 'Tool lock').locator('svg')).toHaveAttribute(
    'data-glyph',
    'lock-closed',
  );
});

test('A13 REQ-C11 a tap on More, on its popover’s padding or on the dock’s, with a creation tool active, creates nothing', async ({
  page,
}) => {
  await openPage(page);
  await toolButton(page, 'Rectangle').tap();
  await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'true');
  await openMore(page);
  await settled(page);
  const popover = await group(page).boundingBox();
  const dock = await page.locator('[data-island="tools"]').boundingBox();
  if (popover === null || dock === null) throw new Error('Not laid out.');
  await page.touchscreen.tap(popover.x + 2, popover.y + popover.height / 2);
  await page.touchscreen.tap(dock.x + 2, dock.y + dock.height / 2);
  await page.waitForTimeout(350);
  await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'true');
  await expect(polite(page)).toHaveText('');
  await expectHistoryDisabled(page);
});

test('A4 on the canvas, d makes More show the diamond and v gives it back its glyph', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  await page.keyboard.press('d');
  await expect(moreButton(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await face(page)).toEqual(['diamond', 'true']);
  await page.keyboard.press('v');
  await expect(moreButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await face(page)).toEqual(['more', 'false']);
});

test('A12 Shift+Tab reaches the dock, End More, Enter opens it on Hand, Escape gives the focus back with the selection kept, and Tab out closes it, each stop with an indicator', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  for (const key of ['r', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await page.keyboard.press('Shift+Tab');
  await expect(toolButton(page, 'Selection')).toBeFocused();
  await expectIndicator(page);
  await page.keyboard.press('End');
  await expect(moreButton(page)).toBeFocused();
  await expectIndicator(page);
  await page.keyboard.press('Enter');
  await expect(toolButton(page, 'Hand')).toBeFocused();
  await expectIndicator(page);
  await page.keyboard.press('ArrowRight');
  await expect(toolButton(page, 'Diamond')).toBeFocused();
  await expectIndicator(page);
  // Keyboard focus shows Diamond's tip at once, and the Escape that closes a tip does nothing
  // else (S3); the next one closes More.
  await expect(page.getByRole('tooltip')).toContainText('Diamond');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(moreButton(page)).toBeFocused();
  await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-island="selection"]')).toBeVisible();
  await expect(toolButton(page, 'Selection')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(toolButton(page, 'Hand')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(canvas(page)).toBeFocused();
  await expectIndicator(page);
});

test('A14 after a reload More is closed', async ({ page }) => {
  await openPage(page);
  await openMore(page);
  await page.reload();
  await expect(canvas(page)).toBeVisible();
  await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(group(page)).toBeHidden();
  expect(await face(page)).toEqual(['more', 'false']);
});
