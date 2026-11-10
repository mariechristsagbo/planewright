import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { expectChrome, expectInk, mouseClick, mouseDrag, toolButton } from './drawing.ts';
import { canvas } from './support.ts';

// Drawn elements selected and undone on the desktop (ENG-11): each selection probe is a handle
// position that only one selection has, so the overlay shows which elements are selected. Every
// press lies below the islands at the top of the window (ADR 0012's row for pointer tests), so the
// pair is drawn 60 px lower than ENG-11 drew it.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await canvas(page).focus();
});

/** The rectangle [60,120,100,80] and the ellipse [220,240,100,80], drawn by drags. */
async function drawPair(page: Page) {
  await page.keyboard.press('r');
  await mouseDrag(page, [60, 120], [160, 200]);
  await page.keyboard.press('o');
  await mouseDrag(page, [220, 240], [320, 320]);
}

/** The rectangle's south-east corner, the ellipse's north-west one and the pair's north-east. */
const PROBES = { rectangle: [160, 200], ellipse: [220, 240], both: [320, 120] } as const;

test('A9 to A14 drawn elements are selected by press, Shift+press, marquee and Mod+A, and cleared by an empty press and Escape', async ({
  page,
}) => {
  await drawPair(page);
  await expectChrome(page, PROBES, ['ellipse']);
  await mouseClick(page, [60, 160]);
  await expectChrome(page, PROBES, ['rectangle']);
  await mouseClick(page, [320, 280], true);
  await expectChrome(page, PROBES, ['both']);
  await mouseClick(page, [60, 160], true);
  await expectChrome(page, PROBES, ['ellipse']);
  await mouseDrag(page, [30, 90], [180, 220]);
  await expectChrome(page, PROBES, ['rectangle']);
  await mouseDrag(page, [30, 90], [340, 340]);
  await expectChrome(page, PROBES, ['both']);
  await mouseClick(page, [600, 410]);
  await expectChrome(page, PROBES, []);
  await page.keyboard.press('ControlOrMeta+A');
  await expectChrome(page, PROBES, ['both']);
  await page.keyboard.press('Escape');
  await expectChrome(page, PROBES, []);
  await expect(toolButton(page, 'Selection')).toHaveAttribute('aria-pressed', 'true');
});

test('A22 to A26 REQ-H01 REQ-H02 REQ-C13 a creation is one undo step, undone and redone by the shortcuts and the buttons', async ({
  page,
}) => {
  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await page.keyboard.press('r');
  await mouseClick(page, [200, 200]);
  await expectInk(page, [[150, 200]]);
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+Z');
  await expectInk(page, [[150, 200]], false);
  await expectChrome(page, { corner: [150, 150] }, []);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await expectInk(page, [[150, 200]]);
  await expectChrome(page, { corner: [150, 150] }, ['corner']);
  await page.keyboard.press('ControlOrMeta+Z');
  await page.keyboard.press('ControlOrMeta+Y');
  await expectInk(page, [[150, 200]]);
  await undo.click();
  await expectInk(page, [[150, 200]], false);
  await expect(redo).toBeEnabled();
  await canvas(page).focus();
  await page.keyboard.press('o');
  await mouseClick(page, [500, 200]);
  await expectInk(page, [[450, 200]]);
  await expect(redo).toBeDisabled();
  await undo.click();
  await expectInk(page, [[450, 200]], false);
  await redo.click();
  await expectInk(page, [[450, 200]]);
});

test('C1 REQ-T01 a drawn dot, once selected, moves when dragged', async ({ page }) => {
  await page.keyboard.press('p');
  await mouseClick(page, [300, 300]);
  await page.keyboard.press('v');
  await mouseClick(page, [300, 300]);
  await mouseDrag(page, [300, 300], [360, 340]);
  await expectInk(page, [[360, 340]]);
  await expectInk(page, [[300, 300]], false);
});
