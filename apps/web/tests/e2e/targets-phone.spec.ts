import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  button,
  elementList,
  expectOptionNames,
  openElements,
  openPage,
  polite,
  targets,
} from './a11y.ts';
import type { Target } from './a11y.ts';
import { moreButton, toolButton, touch } from './drawing.ts';
import { canvas } from './support.ts';

// Touch on the emulated phone of docs/architecture/engine/quality.md (390 x 844 at a device pixel
// ratio of 3, as a mobile page with touch): every target at least 44 x 44 CSS px on phones and under
// a coarse pointer (the v0.2 plan's S8), handle hit squares at 24 px, and the element list operated
// by taps (REQ-Y05, REQ-Y06). The taps at (100, 450) and (250, 600), and the drag from (161.5,
// 511.5) above the open sheet, lie between the top bar and history and zoom above the dock.

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

/** Taps a tool bar button until it shows as pressed, since a tap after a touch can be lost. */
async function choose(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await toolButton(page, name).tap();
    await expect(toolButton(page, name)).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
  }).toPass();
}

/**
 * A 100 by 100 rectangle centred on (100, 450) and an ellipse centred on (250, 600), by taps below
 * the islands at the top of the screen and below the open drawer (ADR 0012's row for pointer
 * tests), then the drawer opened.
 */
async function drawTwo(page: Page): Promise<void> {
  await openPage(page);
  await choose(page, 'Rectangle');
  await touch(page, [100, 450]);
  await choose(page, 'Ellipse');
  await touch(page, [250, 600]);
  await expectOptionNames(await openElements(page), [
    'Ellipse, 100 by 100, at 200, 550',
    'Rectangle, 100 by 100, at 50, 400',
  ]);
}

/** The targets under 44 by 44 CSS px. */
const small = (all: readonly Target[]): Target[] =>
  all.filter(({ width, height }) => width < 44 || height < 44);

test('E3 A9 A10 REQ-Y06 every touch target on the phone is at least 44 by 44 CSS px', async ({
  page,
}) => {
  await drawTwo(page);
  expect(small(await targets(page))).toEqual([]);
});

test('A10 REQ-Y06 with More open every target is at least 44 by 44 CSS px', async ({ page }) => {
  await openPage(page);
  await expect(async () => {
    if ((await moreButton(page).getAttribute('aria-expanded')) !== 'true') {
      await moreButton(page).tap();
    }
    await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass();
  const all = await targets(page);
  expect(all.map(({ name }) => name)).toEqual(
    expect.arrayContaining(['button Hand', 'button Diamond', 'button Tool lock', 'button More']),
  );
  expect(small(all)).toEqual([]);
});

test('E3 A9 REQ-Y06 a touch press 11.5 px off a corner handle, inside its 24 px hit square, resizes', async ({
  page,
}) => {
  await drawTwo(page);
  const rectangle = elementList(page).getByRole('option', { name: /^Rectangle/u });
  await rectangle.tap();
  await expect(polite(page)).toHaveText('1 element selected.');
  // The page never scrolls (ADR 0012), so the canvas is in view; the handle is below the drawer.
  await touch(page, [161.5, 511.5], [201.5, 551.5]);
  await expect(rectangle).toHaveAccessibleName('Rectangle, 140 by 140, at 50, 400');
  await expect(polite(page)).toHaveText('Resized 1 rectangle. 1 element selected.');
});

test('E3 REQ-Y04 REQ-Y05 a tap on a list option selects that element alone, announced, and keeps the focus off the page', async ({
  page,
}) => {
  await drawTwo(page);
  const options = elementList(page).getByRole('option');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await options.last().tap();
  await expect(options.last()).toHaveAttribute('aria-selected', 'true');
  await expect(options.first()).toHaveAttribute('aria-selected', 'false');
  await expect(polite(page)).toHaveText('1 element selected.');
  await expect(elementList(page)).toBeFocused();
  await options.first().tap();
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await expect(options.last()).toHaveAttribute('aria-selected', 'false');
});

// A phone in landscape and a tablet's coarse pointer (the v0.2 plan's S8, issue #73's A10): every
// target at least 44 by 44 CSS px at rest, with a selection and the drawer open, its keys' summary
// and options among them, and with the menu open.
for (const viewport of [
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, deviceScaleFactor: 2 });

    test('A10 REQ-Y06 every target is at least 44 by 44 CSS px at rest, with the drawer and with the menu open', async ({
      page,
    }) => {
      await openPage(page);
      expect(small(await targets(page))).toEqual([]);
      await canvas(page).focus();
      for (const key of ['r', 'Enter']) await page.keyboard.press(key);
      await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
      await openElements(page);
      const open = await targets(page);
      expect(open.map(({ name }) => name)).toEqual(
        expect.arrayContaining(['button Close Elements', 'summary Keys']),
      );
      expect(small(open)).toEqual([]);
      await page.keyboard.press('Escape');
      await button(page, 'Planewright menu').click();
      await expect(page.getByRole('menu')).toBeVisible();
      expect(small(await targets(page))).toEqual([]);
    });
  });
}
