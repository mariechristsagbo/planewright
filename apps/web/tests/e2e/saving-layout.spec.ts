import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { expectIndicator, openElements, openPage, targets, textContrasts } from './a11y.ts';
import { glyphContrasts } from './glyphs.ts';
import { expectPlaced, islands } from './layout.ts';
import type { Viewport } from './layout.ts';
import {
  hideNotices,
  refusableWrites,
  refuseStorage,
  saveStatus,
  showFailedNotice,
  showStaleNotice,
  storageNotices,
} from './storage.ts';

// Where saving's chrome lies and how it reads (ADR 0012, decisions 3 and 14; the v0.2 plan's S7):
// the islands, the problem chip, the shown notices and the open drawer inside the window and
// apart at each listed viewport; the chip as its glyph alone in phone landscape, its words visually
// hidden; the chip's button and Hide at least 44 px on phones and under a coarse pointer; texts at
// 4.5:1, glyphs and the focus ring at 3:1 on the tones' surfaces, and nothing animating.

type State = 'stale' | 'failed' | 'hidden' | 'unavailable';

/** Opens the page in a state where storage needs attention. */
async function openIn(page: Page, state: State): Promise<void> {
  if (state === 'unavailable') await refuseStorage(page);
  if (state === 'failed' || state === 'hidden') await refusableWrites(page);
  await openPage(page);
  if (state === 'stale') await showStaleNotice(page);
  if (state === 'failed' || state === 'hidden') await showFailedNotice(page);
  if (state === 'hidden') await hideNotices(page);
  await expect(saveStatus(page)).toBeVisible();
}

/** The chip lies inside the top-right island, before Elements, and so inside the window. */
async function expectChipPlaced(page: Page): Promise<void> {
  const chip = await saveStatus(page).boundingBox();
  const island = (await islands(page)).find(({ name }) => name === 'top-right');
  if (chip === null || island === undefined) throw new Error('No chip or no top-right island.');
  const inside =
    chip.x >= island.x &&
    chip.y >= island.y &&
    chip.x + chip.width <= island.x + island.width &&
    chip.y + chip.height <= island.y + island.height;
  expect(inside, 'the chip lies inside the top-right island').toBe(true);
}

/** Everything inside the window and apart, with the drawer closed and then open. */
async function expectLaidOut(page: Page, viewport: Viewport): Promise<void> {
  await expectChipPlaced(page);
  const count = (await islands(page)).length;
  await expectPlaced(page, viewport, count);
  await openElements(page);
  await expectPlaced(page, viewport, count + 1);
  await expectChipPlaced(page);
}

const CASES: readonly [Viewport, boolean, readonly State[]][] = [
  [{ width: 1440, height: 900 }, false, ['stale', 'failed', 'hidden']],
  [{ width: 1024, height: 768 }, true, ['unavailable']],
  [{ width: 390, height: 844 }, true, ['stale']],
  [{ width: 360, height: 560 }, true, ['stale']],
  [{ width: 844, height: 390 }, true, ['failed']],
  [{ width: 568, height: 320 }, false, ['failed', 'hidden']],
  [{ width: 844, height: 140 }, false, ['failed', 'hidden']],
];

for (const [viewport, touch, states] of CASES) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}${touch ? ' with touch' : ''}`, () => {
    test.use({ viewport, isMobile: touch, hasTouch: touch });

    for (const state of states) {
      test(`A10 the islands, the chip, the notices and the open drawer lie inside the window and apart, ${state}`, async ({
        page,
      }) => {
        await openIn(page, state);
        await expectLaidOut(page, viewport);
      });
    }
  });
}

/** How the chip's words are displayed: visually hidden, never removed. */
const WORDS_DISPLAY = `getComputedStyle(document.querySelector('#save-status .problem-chip-words')).display`;

for (const viewport of [
  { width: 844, height: 390 },
  { width: 390, height: 844 },
  { width: 360, height: 560 },
]) {
  test.describe(`on a phone at ${String(viewport.width)} × ${String(viewport.height)} with touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test('A9 the chip shows its glyph alone, at least 44 px wide, with its words visually hidden and no chevron', async ({
      page,
    }) => {
      await openIn(page, 'failed');
      for (const folded of [false, true]) {
        if (folded) await hideNotices(page);
        const chip = saveStatus(page);
        expect((await chip.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);
        const words = chip.locator('.problem-chip-words');
        expect(await page.evaluate(WORDS_DISPLAY)).toBe('block');
        expect((await words.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
        await expect(chip.locator('svg[data-glyph="chevron-down"]')).toBeHidden();
        await expect(chip.locator('svg[data-glyph="status-problem"]')).toBeVisible();
      }
      await expect(page.getByRole('button', { name: 'Not saved' })).toHaveAccessibleName(
        'Not saved',
      );
      await expect(page.getByRole('button', { name: 'Elements' })).toBeVisible();
    });
  });
}

for (const [viewport, touch] of [
  [{ width: 390, height: 844 }, true],
  [{ width: 844, height: 390 }, true],
  [{ width: 1024, height: 768 }, true],
  [{ width: 1440, height: 900 }, false],
] as const) {
  test.describe(`targets at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport, isMobile: touch, hasTouch: touch });

    test('A10 R11 the chip’s button and Hide are 44 by 44 px on phones and under a coarse pointer, 24 elsewhere', async ({
      page,
    }) => {
      await openIn(page, 'failed');
      const least = touch ? 44 : 24;
      const sized = async (name: string) =>
        (await targets(page)).filter((target) => target.name === name);
      const [hide] = await sized('button Hide storage notices');
      await hideNotices(page);
      const [chip] = await sized('button Not saved');
      for (const target of [hide, chip]) {
        expect(target?.width ?? 0).toBeGreaterThanOrEqual(least);
        expect(target?.height ?? 0).toBeGreaterThanOrEqual(least);
      }
    });
  });
}

test.describe('contrast and motion at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const state of ['failed', 'stale'] as const) {
    test(`A11 under the ${state} notice the chip’s and the notices’ texts reach 4.5:1, their glyphs and the focus ring 3:1, and nothing animates`, async ({
      page,
    }) => {
      await openIn(page, state);
      const words = /Not saved|Saving failed|Another tab|Load the newer|Keep this|^Hide$/u;
      const texts = (await textContrasts(page)).filter(({ text }) => words.test(text));
      expect(texts.length).toBeGreaterThanOrEqual(3);
      expect(texts.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
      const glyphs = (await glyphContrasts(page)).filter(({ glyph }) => glyph.startsWith('status'));
      expect(glyphs).toHaveLength(1);
      expect(glyphs.filter(({ computed }) => computed < 3)).toEqual([]);
      for (const control of await storageNotices(page).getByRole('button').all()) {
        await control.focus();
        await expectIndicator(page);
      }
      expect(await page.evaluate('document.getAnimations().length')).toBe(0);
    });
  }
});
