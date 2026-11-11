import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { elementList, expectOptionNames, openElements, openPage, polite, targets } from './a11y.ts';
import { toolButton, touch } from './drawing.ts';

// Touch on the emulated phone of docs/architecture/engine/quality.md (390 x 844 at a device pixel
// ratio of 3, as a mobile page with touch): every target at least 24 x 24 CSS px, handle hit
// squares included, and the element list operated by taps (REQ-Y05, REQ-Y06).

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

test('E3 A9 REQ-Y06 every touch target on the phone is at least 24 by 24 CSS px', async ({
  page,
}) => {
  await drawTwo(page);
  const all = await targets(page);
  expect(all.length).toBeGreaterThanOrEqual(20);
  expect(all.filter(({ width, height }) => width < 24 || height < 24)).toEqual([]);
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
