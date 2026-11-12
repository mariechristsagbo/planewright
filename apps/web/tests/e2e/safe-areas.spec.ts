import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { openElements, openPage, polite } from './a11y.ts';
import { expectPlaced, islands } from './layout.ts';
import type { Viewport } from './layout.ts';
import { canvas } from './support.ts';

// The safe areas (ADR 0012, decision 14; the v0.2 plan's S8, issue #73's A9): every island lies 8 px
// plus that side's inset from each window edge, the phone's sheets reach the window's edges with
// their content above the bottom inset, and with no inset every distance is 8 px. The emulator
// reports no inset, so the tests set the shell's --shell-safe-* properties on the root element;
// the values are test inputs, not device claims. Page code is written as strings, since these files
// compile without the DOM library.

type Insets = Readonly<Record<'top' | 'right' | 'bottom' | 'left', number>>;

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Sets the shell's inset properties on the root element, as the browser's env() would give them. */
async function emulate(page: Page, insets: Insets): Promise<void> {
  const sides = Object.entries(insets).map(
    ([side, value]) => `style.setProperty('--shell-safe-${side}', '${String(value)}px');`,
  );
  await page.evaluate(
    `(() => { const { style } = document.documentElement; ${sides.join(' ')} })()`,
  );
}

/** The nearest island's distance to each window edge. */
async function distances(page: Page, { width, height }: Viewport): Promise<Insets> {
  const boxes = await islands(page);
  return {
    top: Math.min(...boxes.map(({ y }) => y)),
    right: Math.min(...boxes.map(({ x, width: w }) => width - x - w)),
    bottom: Math.min(...boxes.map(({ y, height: h }) => height - y - h)),
    left: Math.min(...boxes.map(({ x }) => x)),
  };
}

const plus8 = (insets: Insets): Insets => ({
  top: insets.top + 8,
  right: insets.right + 8,
  bottom: insets.bottom + 8,
  left: insets.left + 8,
});

/**
 * An open sheet's box, and the lowest bottom of the innermost elements that it shows, leaving out
 * visually hidden copies and the closed keys' text, which Chromium lays out without rendering it.
 */
const SHEET = (id: string) => `(() => {
  const sheet = document.getElementById('${id}');
  const box = sheet.getBoundingClientRect();
  const content = Math.max(...[...sheet.querySelectorAll('*')].filter((element) => element.childElementCount === 0 && element.checkVisibility()).map((element) => element.getBoundingClientRect()).filter((r) => r.width > 1 && r.height > 1).map((r) => r.bottom));
  return { x: box.x, right: box.right, bottom: box.bottom, content };
})()`;

interface Sheet {
  readonly x: number;
  readonly right: number;
  readonly bottom: number;
  readonly content: number;
}

const CASES: readonly [Viewport, Insets][] = [
  [
    { width: 390, height: 844 },
    { top: 47, right: 0, bottom: 34, left: 0 },
  ],
  [
    { width: 844, height: 390 },
    { top: 0, right: 47, bottom: 21, left: 47 },
  ],
];

for (const [viewport, insets] of CASES) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('A9 with no inset every island’s nearest distance to each edge is 8 px', async ({
      page,
    }) => {
      await openPage(page);
      expect(await distances(page, viewport)).toEqual(plus8(NONE));
      await expectPlaced(page, viewport, (await islands(page)).length);
    });

    test(`A9 with insets ${JSON.stringify(insets)} each island lies 8 px plus that side’s inset from each edge`, async ({
      page,
    }) => {
      await openPage(page);
      await emulate(page, insets);
      expect(await distances(page, viewport)).toEqual(plus8(insets));
      await expectPlaced(page, viewport, (await islands(page)).length);
    });
  });
}

test.describe('at 390 × 844 with touch and insets, the sheets', () => {
  const viewport = { width: 390, height: 844 };
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  test.use({ viewport, isMobile: true, hasTouch: true });

  test('A9 the Elements and Details sheets reach the window’s edges, their content above the bottom inset', async ({
    page,
  }) => {
    await openPage(page);
    await emulate(page, insets);
    await openElements(page);
    const elements = await page.evaluate<Sheet>(SHEET('element-list-drawer'));
    expect([elements.x, elements.right, elements.bottom]).toEqual([0, 390, 844]);
    expect(elements.content).toBeLessThanOrEqual(844 - insets.bottom);
    await expectPlaced(page, viewport, (await islands(page)).length);
    await page.keyboard.press('Escape');
    await canvas(page).focus();
    for (const key of ['r', 'Enter']) await page.keyboard.press(key);
    await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
    await page.locator('[data-island="selection"]').getByRole('button', { name: 'Details' }).tap();
    await expect(page.getByRole('region', { name: 'Details' })).toBeVisible();
    const details = await page.evaluate<Sheet>(SHEET('details-sheet'));
    expect([details.x, details.right, details.bottom]).toEqual([0, 390, 844]);
    expect(details.content).toBeLessThanOrEqual(844 - insets.bottom);
    await expectPlaced(page, viewport, (await islands(page)).length);
  });
});
