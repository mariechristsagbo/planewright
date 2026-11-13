import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { worldBounds } from '../../../../packages/engine/src/geometry/world-bounds.ts';
import { elementList, elementsToggle } from './a11y.ts';
import { elementCount, openRecords } from './fixture-page.ts';
import { islands } from './layout.ts';
import type { Box } from './layout.ts';
import { selectionSurface } from './panel.ts';
import {
  BRANCH_FONT,
  DESKTOP_CAMERA,
  LANDSCAPE_CAMERA,
  TEXT_WIDTHS,
  showcaseElements,
  showcaseRecords,
} from './showcase-fixture.ts';
import type { Camera } from './showcase-fixture.ts';
import { saveState, saveStatus, storageNotices } from './storage.ts';
import { VISUAL_CONTEXT, ready } from './visual.ts';

// The README's two screenshots (issue #52): the flow diagram of showcase-fixture.ts, stored through
// IndexedDB as the S13 fixture is, at 1440 × 900 at 100 % with the Elements drawer open beside it,
// and whole at 75 % on an 844 × 390 phone in landscape with the safe-area insets of
// safe-areas.spec.ts. They are not states of ADR 0012's matrix, which visual-desktop.spec.ts and
// visual-touch.spec.ts hold, but they are made, compared and checked as its baselines are: by CI's
// Chromium, of the whole viewport with every animation finished and nothing masked. Before each
// capture the page must be saved with no notice and measure every word as wide as the fixture says,
// and every element of the diagram must lie inside the window's safe area, clear of all the chrome
// that shows.

/** The words of the diagram as the editor measures them, by their font's size. */
const MEASURED = `(async () => {
  await document.fonts.ready;
  const context = document.createElement('canvas').getContext('2d');
  return ${JSON.stringify(Object.keys(TEXT_WIDTHS))}.map((text) => {
    const size = ${JSON.stringify(['yes', 'not yet'])}.includes(text) ? ${String(BRANCH_FONT.size)} : 20;
    context.font = size + 'px "Planewright Sans", sans-serif';
    return [text, context.measureText(text).width];
  });
})()`;

/** The boxes of the visible chrome: every island, the drawer and the tool's hint. */
const CHROME = `[...document.querySelectorAll('[data-island], .island, #element-list-drawer, #tool-hint')]
  .filter((element) => element.checkVisibility({ visibilityProperty: true }))
  .map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { name: element.dataset.island || element.id || element.className, x, y, width, height };
  })
  .filter(({ width, height }) => width > 0 && height > 0)`;

/** The safe-area insets of safe-areas.spec.ts's phone in landscape: test inputs, not a device's. */
const LANDSCAPE_INSETS = { top: 0, right: 47, bottom: 21, left: 47 } as const;
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 } as const;
type Insets = Readonly<Record<'top' | 'right' | 'bottom' | 'left', number>>;

/** How far every element of the diagram keeps from the chrome and the safe area's edges. */
const MARGIN = 12;

/** Sets the shell's inset properties on the root element, as safe-areas.spec.ts emulates them. */
async function emulate(page: Page, insets: Insets): Promise<void> {
  const sides = Object.entries(insets).map(
    ([side, value]) => `style.setProperty('--shell-safe-${side}', '${String(value)}px');`,
  );
  await page.evaluate(
    `(() => { const { style } = document.documentElement; ${sides.join(' ')} })()`,
  );
}

/** Each element's bounds on the canvas under a camera, named by its kind and words. */
const onCanvas = (camera: Camera): Box[] =>
  showcaseElements().map((element) => {
    const { x, y, width, height } = worldBounds(element);
    const words = element.kind === 'text' ? ` "${element.content.text}"` : '';
    return {
      name: `${element.kind}${words} ${element.id}`,
      x: (x - camera.x) * camera.zoom,
      y: (y - camera.y) * camera.zoom,
      width: width * camera.zoom,
      height: height * camera.zoom,
    };
  });

const meet = (a: Box, b: Box, margin: number) =>
  a.x - margin < b.x + b.width &&
  b.x < a.x + a.width + margin &&
  a.y - margin < b.y + b.height &&
  b.y < a.y + a.height + margin;

/** A box as its left, top, right and bottom, rounded, for a failure's message. */
const boxText = ({ x, y, width, height }: Box) =>
  `[${[x, y, x + width, y + height].map((value) => Math.round(value)).join(', ')}]`;

/** Opens the showcase under a camera, saved, with no notice and every word measured as stored. */
async function openShowcase(page: Page, camera: Camera): Promise<number> {
  const count = await openRecords(page, showcaseRecords(camera));
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'saved');
  await expect(saveStatus(page)).toHaveCount(0);
  await expect(storageNotices(page)).toHaveCount(0);
  const measured = await page.evaluate<[string, number][]>(MEASURED);
  expect(Object.fromEntries(measured), 'each word as wide as the editor measures it').toEqual(
    TEXT_WIDTHS,
  );
  return count;
}

/** Every element of the diagram lies in the safe area, a margin clear of it and of the chrome. */
async function expectClear(page: Page, camera: Camera, insets: Insets): Promise<void> {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  const safe = {
    left: insets.left + MARGIN,
    top: insets.top + MARGIN,
    right: width - insets.right - MARGIN,
    bottom: height - insets.bottom - MARGIN,
  };
  const shown = onCanvas(camera);
  const outside = shown.filter(
    (box) =>
      box.x < safe.left ||
      box.y < safe.top ||
      box.x + box.width > safe.right ||
      box.y + box.height > safe.bottom,
  );
  expect(
    outside.map(({ name }) => name),
    'inside the safe area',
  ).toEqual([]);
  const chrome = await page.evaluate<Box[]>(CHROME);
  const covered = shown.flatMap((box) =>
    chrome
      .filter((piece) => meet(box, piece, MARGIN))
      .map((piece) => `${box.name} ${boxText(box)} × ${piece.name} ${boxText(piece)}`),
  );
  expect(covered, 'clear of the chrome').toEqual([]);
}

test.describe('the README showcase at 1440 × 900', () => {
  test.use({ ...VISUAL_CONTEXT, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  test('README desktop, the flow diagram at 100 % beside the open Elements drawer', async ({
    page,
  }) => {
    const count = await openShowcase(page, DESKTOP_CAMERA);
    await elementsToggle(page).click();
    await expect(elementList(page).getByRole('option')).toHaveCount(count);
    await expect(selectionSurface(page)).toHaveCount(0);
    await ready(page, { touch: false, fixture: true });
    await expectClear(page, DESKTOP_CAMERA, NO_INSETS);
    await expect(page).toHaveScreenshot('readme-desktop-1440x900.png');
  });
});

test.describe('the README showcase on an 844 × 390 phone in landscape', () => {
  test.use({
    ...VISUAL_CONTEXT,
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });

  test('README landscape, the whole flow diagram at 75 % within the safe-area insets', async ({
    page,
  }) => {
    const count = await openShowcase(page, LANDSCAPE_CAMERA);
    await emulate(page, LANDSCAPE_INSETS);
    await expect(elementCount(page)).toHaveText(String(count));
    await expect(selectionSurface(page)).toHaveCount(0);
    await expect(page.locator('[data-island="tools"]').getByRole('button')).toHaveCount(9);
    await ready(page, { touch: true, fixture: true });
    const boxes = await islands(page);
    expect({
      left: Math.min(...boxes.map(({ x }) => x)),
      right: 844 - Math.max(...boxes.map(({ x, width }) => x + width)),
      bottom: 390 - Math.max(...boxes.map(({ y, height }) => y + height)),
    }).toEqual({ left: 47 + 8, right: 47 + 8, bottom: 21 + 8 });
    await expectClear(page, LANDSCAPE_CAMERA, LANDSCAPE_INSETS);
    await expect(page).toHaveScreenshot('readme-landscape-844x390.png');
  });
});
