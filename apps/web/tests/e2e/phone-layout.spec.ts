import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { button, elementsToggle, expectIndicator, openElements, openPage, polite } from './a11y.ts';
import { moreButton, toolButton } from './drawing.ts';
import { expectPlaced, islands } from './layout.ts';
import type { Viewport } from './layout.ts';
import { hideNotices, refusableWrites, showFailedNotice, showStaleNotice } from './storage.ts';
import { canvas } from './support.ts';

// The phone composition's layout matrix and tab orders (ADR 0012, decisions 13 and 14; the v0.2
// plan's S8, issue #73's A11 and A12): in every listed state every island, the shown notices and the
// open sheets lie inside the window and apart, but for inert islands under a sheet, and the page
// never scrolls; on phones the Tab key visits the menu, Pre-release, the tool bar's one stop, the
// canvas, Elements, history and zoom, and Keyboard shortcuts where it shows, forwards and
// backwards, each stop with a visible indicator. The landscape states are shell-layout.spec.ts's.

type State = (page: Page) => Promise<void>;

/** Draws a rectangle with Enter from the canvas, which stays selected. */
async function select(page: Page): Promise<void> {
  await canvas(page).focus();
  for (const key of ['r', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
}

const PORTRAIT: Readonly<Record<string, State>> = {
  'at rest': () => Promise.resolve(),
  'with More open': async (page) => {
    await moreButton(page).tap();
    await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'true');
  },
  'with the selection bar': select,
  'under the stale notice': showStaleNotice,
  'with the notices hidden in the chip': async (page) => {
    await showFailedNotice(page);
    await hideNotices(page);
  },
  'with the Elements sheet': async (page) => {
    await openElements(page);
  },
  'with the Details sheet': async (page) => {
    await select(page);
    await page.locator('[data-island="selection"]').getByRole('button', { name: 'Details' }).tap();
    await expect(page.getByRole('region', { name: 'Details' })).toBeVisible();
  },
};

/** The page's scroll position after asking it to scroll. */
const SCROLLED = `(() => { window.scrollTo(0, 100); document.body.scrollTop = 100; return [window.scrollX, window.scrollY, document.body.scrollTop, document.querySelector('.editor-shell').scrollTop]; })()`;

async function expectLaidOut(page: Page, viewport: Viewport): Promise<void> {
  await expectPlaced(page, viewport, (await islands(page)).length);
  expect(await page.evaluate(SCROLLED)).toEqual([0, 0, 0, 0]);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 360, height: 560 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    for (const [name, state] of Object.entries(PORTRAIT)) {
      test(`A11 every island lies inside the window and apart, ${name}`, async ({ page }) => {
        if (name.includes('chip')) await refusableWrites(page);
        await openPage(page);
        await state(page);
        await expectLaidOut(page, viewport);
      });
    }
  });
}

test.describe('at 1024 × 768 with touch', () => {
  const viewport = { width: 1024, height: 768 };
  test.use({ viewport, isMobile: true, hasTouch: true });

  test('A11 every island lies inside the window and apart at rest, with a selection and with the drawer', async ({
    page,
  }) => {
    await openPage(page);
    await expectLaidOut(page, viewport);
    await select(page);
    await expectLaidOut(page, viewport);
    await openElements(page);
    await expectLaidOut(page, viewport);
  });
});

/** Tabs through the stops, then back, each focused with a visible indicator. */
async function expectTabOrder(page: Page, stops: readonly Locator[]): Promise<void> {
  for (const stop of stops) {
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
    await expectIndicator(page);
  }
  for (const stop of stops.slice(0, -1).reverse()) {
    await page.keyboard.press('Shift+Tab');
    await expect(stop).toBeFocused();
    await expectIndicator(page);
  }
}

const ORDERS: readonly [Viewport, string, boolean][] = [
  [{ width: 390, height: 844 }, 'Selection', false],
  [{ width: 844, height: 390 }, 'Hand', true],
];

for (const [viewport, first, keys] of ORDERS) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch, the tab order`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test(`A12 D11 Tab visits the menu, Pre-release, the tool bar's stop, the canvas, Elements, history and zoom${keys ? ' and Keyboard shortcuts' : ''}, forwards and backwards`, async ({
      page,
    }) => {
      await openPage(page);
      await expectTabOrder(page, [
        button(page, 'Planewright menu'),
        button(page, 'Pre-release'),
        toolButton(page, first),
        canvas(page),
        elementsToggle(page),
        button(page, 'Undo'),
        button(page, 'Redo'),
        button(page, 'Zoom out'),
        button(page, /^Reset zoom/u),
        button(page, 'Zoom in'),
        button(page, 'Zoom to fit'),
        ...(keys ? [button(page, 'Keyboard shortcuts')] : []),
      ]);
      await page.keyboard.press('Tab');
      await expect(page.locator('body')).not.toBeFocused();
    });
  });
}
