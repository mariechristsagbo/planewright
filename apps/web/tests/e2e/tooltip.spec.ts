import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { canvas, canvasBox } from './support.ts';

// The chrome's tooltips (ADR 0012 and the v0.2 plan's S3): a control's tip opens at once on
// keyboard focus and after 500 ms of hover, never on touch, and closes on Escape or when the
// pointer leaves; it repeats the control's name and keys, which the control keeps.

const tip = (page: Page): Locator => page.getByRole('tooltip');

/** Longer than the live region's pause before a message, so that a change would have shown. */
const SETTLE_MS = 300;

/** The hover delay token as the page computes it, which the built style sheet may write ".5s". */
const DELAY_TOKEN = `getComputedStyle(document.querySelector('main')).getPropertyValue('--pw-delay-tooltip').trim()`;

/**
 * Starts measuring in the page, apart from the test's own round trips, the time from the pointer's
 * arrival on a control that names a tip to the tip's showing, in milliseconds, which HOVER_TO_TIP
 * then gives.
 */
const MEASURE_HOVER = `void (window.hoverToTip = new Promise((resolve) => {
  const tip = document.getElementById('chrome-tip');
  let arrived = null;
  document.addEventListener('pointerover', (event) => {
    if (arrived === null && event.target.closest('[data-chrome-tip]') !== null) arrived = performance.now();
  }, true);
  new MutationObserver(() => {
    if (!tip.hidden && arrived !== null) resolve(performance.now() - arrived);
  }).observe(tip, { attributeFilter: ['hidden'] });
}))`;
const HOVER_TO_TIP = 'window.hoverToTip';

/** The centre of a control, where the mouse rests on it. */
async function centreOf(control: Locator): Promise<[number, number]> {
  const box = await control.boundingBox();
  if (box === null) throw new Error('The control is not laid out.');
  return [box.x + box.width / 2, box.y + box.height / 2];
}

test('D4 D6 A6 a tooltip appears at once on keyboard focus and closes on Escape, the focus staying', async ({
  page,
}) => {
  await openPage(page);
  const hand = toolButton(page, 'Hand');
  await page.keyboard.press('Tab');
  await expect(tip(page)).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(hand).toBeFocused();
  await expect(tip(page)).toBeVisible({ timeout: 250 });
  await expect(tip(page)).toHaveText(/^Hand\s*H$/u);
  // A description: the control keeps its name, keys and description while its tip shows.
  await expect(hand).toHaveAccessibleName('Hand');
  await expect(hand).toHaveAttribute('aria-keyshortcuts', 'H');
  await expect(hand).toHaveAccessibleDescription('Shortcut H. Drag to pan the canvas.');
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  await expect(hand).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tip(page)).toHaveText(/^Selection\s*V\s*or\s*1$/u, { timeout: 250 });
  await page.keyboard.press('Tab');
  await expect(tip(page)).toHaveCount(0);
});

test('D4 A6 the Escape that closes a tip goes no further: the chosen tool and the selection stay until a second Escape', async ({
  page,
}) => {
  await openPage(page);
  const rectangle = toolButton(page, 'Rectangle');
  for (const key of ['Tab', 'Tab', 'ArrowRight', 'ArrowRight', 'Enter']) {
    await page.keyboard.press(key);
  }
  await expect(rectangle).toHaveAttribute('aria-pressed', 'true');
  await expect(tip(page)).toHaveText(/^Rectangle\s*R\s*or\s*2$/u);
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  await page.waitForTimeout(SETTLE_MS);
  await expect(rectangle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(rectangle).toHaveAttribute('aria-pressed', 'false');
  await expect(toolButton(page, 'Selection')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Tab');
  await expect(canvas(page)).toBeFocused();
  for (const key of ['r', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await page.keyboard.press('Shift+Tab');
  await expect(rectangle).toBeFocused();
  await expect(tip(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  await page.waitForTimeout(SETTLE_MS);
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
  await page.keyboard.press('Escape');
  await expect(polite(page)).toHaveText('Nothing selected.');
});

test('D4 A6 an Escape on a focus tip leaves the hover tip of its control free to open later', async ({
  page,
}) => {
  await openPage(page);
  const hand = toolButton(page, 'Hand');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(tip(page)).toHaveText(/^Hand\s*H$/u);
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  const [x, y] = await centreOf(hand);
  await page.mouse.move(x, y);
  await expect(tip(page)).toHaveText(/^Hand\s*H$/u);
});

test('D4 D6 A6 a hover tooltip appears after its delay and closes when the pointer leaves', async ({
  page,
}) => {
  await openPage(page);
  expect(await page.evaluate<string>(DELAY_TOKEN)).toMatch(/^(?:500ms|0?\.5s)$/u);
  const rectangle = toolButton(page, 'Rectangle');
  const [x, y] = await centreOf(rectangle);
  await page.evaluate(MEASURE_HOVER);
  await page.mouse.move(x, y);
  // Bounded from both sides in the page, since the test's own round trips can run late on a loaded
  // machine: still hidden at 250 ms and up to 450 ms after the pointer arrives, shown by 700 ms.
  const delay = await page.evaluate<number>(HOVER_TO_TIP);
  expect(delay).toBeGreaterThanOrEqual(450);
  expect(delay).toBeLessThanOrEqual(700);
  await expect(tip(page)).toBeVisible();
  await expect(tip(page)).toHaveText(/^Rectangle\s*R\s*or\s*2$/u);
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(tip(page)).toHaveCount(0);
  await page.mouse.move(x, y);
  await expect(tip(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
  await expect(rectangle).toHaveAttribute('aria-pressed', 'false');
});

test('D4 A6 a hover tooltip stays open while the pointer moves onto it, under its control or over it, and closes when the pointer leaves both', async ({
  page,
}) => {
  await openPage(page);
  const box = await canvasBox(page);
  const controls: [Locator, RegExp][] = [
    [toolButton(page, 'Rectangle'), /^Rectangle\s*R\s*or\s*2$/u],
    [page.getByRole('button', { name: 'Zoom in', exact: true }), /^Zoom in\s*Ctrl\+=/u],
  ];
  for (const [control, said] of controls) {
    const [x, y] = await centreOf(control);
    await page.mouse.move(x, y);
    await expect(tip(page)).toHaveText(said);
    const [toX, toY] = await centreOf(tip(page));
    // In steps of about 3 px, across the 8 px between the control and its tip.
    const steps = Math.ceil(Math.abs(toY - y) / 3);
    for (let step = 1; step <= steps; step += 1) {
      await page.mouse.move(x + ((toX - x) * step) / steps, y + ((toY - y) * step) / steps);
      expect(await tip(page).isVisible()).toBe(true);
    }
    await page.waitForTimeout(SETTLE_MS);
    await expect(tip(page)).toHaveText(said);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await expect(tip(page)).toHaveCount(0);
  }
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('D4 A6 a tap never opens a tooltip, while it still chooses the tool', async ({ page }) => {
    await openPage(page);
    const rectangle = toolButton(page, 'Rectangle');
    await expect(async () => {
      await rectangle.tap();
      await expect(rectangle).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    }).toPass();
    await page.waitForTimeout(800);
    await expect(tip(page)).toHaveCount(0);
  });
});
