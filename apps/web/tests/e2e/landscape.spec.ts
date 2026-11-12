import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { elementsToggle, openPage } from './a11y.ts';
import { moreButton } from './drawing.ts';
import { islands } from './layout.ts';
import type { Box } from './layout.ts';
import { refusableWrites, saveStatus, showFailedNotice } from './storage.ts';
import { readout } from './support.ts';

// A phone in landscape and the readout's place (ADR 0012, decisions 2 and 14; the v0.2 plan's S8,
// issue #73's A6 to A8): under 500 px high the whole palette, 44 px, sits in the top row between
// identity and the top-right island, one row at rest and with the failed chip, with no More; under
// 600 px wide it keeps a row of its own; the view readout is hidden on phones, keeping its text,
// and shown at compact and desktop widths; Keyboard shortcuts stays alone at the bottom right.
// Page code is written as strings, since these files compile without the DOM library.

/** The tool bar's buttons' boxes, as [x, y, width, height]. */
const BUTTONS = `[...document.querySelector('[role="toolbar"][aria-label="Tools"]').querySelectorAll('button')]
  .map((button) => { const { x, y, width, height } = button.getBoundingClientRect(); return [x, y, width, height]; })`;

const PALETTE = [
  'Hand',
  'Selection',
  'Rectangle',
  'Ellipse',
  'Diamond',
  'Line',
  'Freehand',
  'Text',
  'Tool lock',
];

/** The named islands' boxes, or a failed test. */
async function boxesOf(page: Page, ...names: string[]): Promise<Box[]> {
  const boxes = await islands(page);
  return names.map((name) => {
    const box = boxes.find((each) => each.name === name);
    if (box === undefined) throw new Error(`No ${name} island.`);
    return box;
  });
}

/** The nine palette buttons, at least 44 px, share one row. */
async function expectOneRow(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Tools' });
  for (const [index, name] of PALETTE.entries()) {
    await expect(toolbar.getByRole('button').nth(index)).toHaveAccessibleName(name);
  }
  const buttons = await page.evaluate<number[][]>(BUTTONS);
  expect(buttons).toHaveLength(PALETTE.length);
  expect(new Set(buttons.map(([, y]) => y)).size).toBe(1);
  expect(buttons.filter(([, , width = 0, height = 0]) => width < 44 || height < 44)).toEqual([]);
  await expect(moreButton(page)).toHaveCount(0);
  await expect(page.locator('#more-tools')).toHaveCount(0);
}

/** The palette sits in the top row, between identity and the top-right island. */
async function expectInTopRow(page: Page): Promise<void> {
  const [identity, tools, topRight] = await boxesOf(page, 'identity', 'tools', 'top-right');
  if (identity === undefined || tools === undefined || topRight === undefined) return;
  expect([tools.y, topRight.y]).toEqual([identity.y, identity.y]);
  expect(identity.x + identity.width).toBeLessThanOrEqual(tools.x);
  expect(tools.x + tools.width).toBeLessThanOrEqual(topRight.x);
}

test.describe('at 844 × 390 with touch', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('A7 D6 the whole palette, Hand, Diamond and Tool lock included, is one row of 44 px buttons in the top row, with no More', async ({
    page,
  }) => {
    await openPage(page);
    await expectOneRow(page);
    await expectInTopRow(page);
  });

  test('A7 D6 the palette is still one row in the top row under the failed chip, Elements keeping its name', async ({
    page,
  }) => {
    await refusableWrites(page);
    await openPage(page);
    await showFailedNotice(page);
    await expect(saveStatus(page)).toBeVisible();
    await expectOneRow(page);
    await expectInTopRow(page);
    await expect(elementsToggle(page)).toHaveAccessibleName(/^Elements/u);
  });

  test('A6 A8 D5 D7 the readout is hidden yet keeps its text, and Keyboard shortcuts sits alone at the bottom right', async ({
    page,
  }) => {
    await openPage(page);
    await expect(readout(page)).toBeHidden();
    await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
    const island = page.locator('[data-island="bottom-right"]');
    await expect(island.getByRole('button')).toHaveCount(1);
    await expect(island.getByRole('button')).toHaveAccessibleName('Keyboard shortcuts');
    const [history, keys] = await boxesOf(page, 'bottom-left', 'bottom-right');
    if (history === undefined || keys === undefined) return;
    expect([keys.x + keys.width, keys.y + keys.height]).toEqual([844 - 8, 390 - 8]);
    expect(history.y + history.height).toBe(390 - 8);
  });
});

test.describe('at 568 × 320 with touch', () => {
  test.use({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true });

  test('A7 D6 the palette is one row in a row of its own under identity and Elements', async ({
    page,
  }) => {
    await openPage(page);
    await expectOneRow(page);
    const [identity, tools, topRight] = await boxesOf(page, 'identity', 'tools', 'top-right');
    if (identity === undefined || tools === undefined || topRight === undefined) return;
    // The palette's row comes right after the top row, one gap under it, not at the bottom.
    const top = Math.max(identity.y + identity.height, topRight.y + topRight.height);
    expect(tools.y).toBeGreaterThanOrEqual(top);
    expect(tools.y - top).toBeLessThanOrEqual(8);
    await expect(readout(page)).toBeHidden();
  });
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 800, height: 720 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('A8 D7 the readout is shown with its text at the bottom right', async ({ page }) => {
      await openPage(page);
      await expect(readout(page)).toBeVisible();
      await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
      await expect(
        page.locator('[data-island="bottom-right"]').locator('#view-readout'),
      ).toHaveCount(1);
    });
  });
}
