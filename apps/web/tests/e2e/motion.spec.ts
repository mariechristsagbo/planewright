import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { button, elementsToggle, openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { checkEntrance, checkEntranceTime, settledBox } from './entrance.ts';
import {
  animations,
  firstFrame,
  holdEntrance,
  probeMotion,
  probed,
  release,
  settled,
  watchFirstFrame,
} from './motion.ts';
import { onCanvas, selectionSurface } from './panel.ts';
import { ABOUT, DESKTOPS, DRAWER, MENU, escape, menuButton } from './surfaces.ts';
import { showFailedNotice, saveStatus, refusableWrites } from './storage.ts';
import { canvas, readout } from './support.ts';

// The entrances of ADR 0012's D2 on desktops, at compact widths and with touch (the v0.2 plan's
// S12): each surface enters once by opacity and a short translation, read and seeked with the Web
// Animations API; only D2's surfaces animate; a menu item's highlight fades; and the focus, the
// keys and the boxes behave as before while an entrance runs.

/** The page's CSS animations, the entrances, without a menu item's highlight transition. */
const entrances = async (page: Page) =>
  (await animations(page)).filter(({ kind }) => kind === 'CSSAnimation');

for (const { width, height, touch, surfaces } of DESKTOPS) {
  test.describe(`at ${String(width)} × ${String(height)}${touch ? ' with touch' : ''}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch });

    for (const [name, surface] of surfaces) {
      test(`A3 A4 A9 ${name} enters once by opacity and translation over D2’s duration, settling where it shows under reduced motion`, async ({
        page,
      }) => {
        await checkEntrance(page, surface);
      });
    }
  });
}

test.describe('at 1280 × 720', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const [name, surface] of [
    ['the menu', MENU],
    ['the Elements drawer', DRAWER],
    ['About this build', ABOUT],
  ] as const) {
    test(`A4 ${name}’s entrance, left to run, ends within its duration and 500 ms`, async ({
      page,
    }) => {
      await checkEntranceTime(page, surface);
    });
  }

  test('A5 nothing animates at load, nor for tooltips, the canvas’s ring and chip, a tool change and its hint, a text’s hint chip or the empty-canvas note', async ({
    page,
  }) => {
    await openPage(page);
    expect(await animations(page)).toEqual([]);
    await probeMotion(page);
    await toolButton(page, 'Rectangle').hover();
    await expect(page.getByRole('tooltip')).toHaveText(/^Rectangle/u);
    await page.mouse.move(640, 400);
    for (let tab = 0; tab < 3; tab += 1) await page.keyboard.press('Tab');
    await expect(page.getByRole('tooltip')).toHaveText(/^Hand/u);
    await page.keyboard.press('Tab');
    await expect(canvas(page)).toBeFocused();
    await expect(page.locator('.canvas-focus-chip')).toBeVisible();
    await page.keyboard.press('r');
    await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(page.locator('.empty-canvas-note')).toHaveCount(0);
    await page.keyboard.press('Delete');
    await expect(page.locator('.empty-canvas-note')).toBeVisible();
    await page.keyboard.press('t');
    await page.keyboard.press('Enter');
    await expect(page.locator('#text-editor-hint')).toBeVisible();
    await escape(page);
    await settled(page);
    // The selection panel's entrance aside, which the rectangle mounted.
    expect(
      (await probed(page)).events.filter((event) => !event.includes('selection-panel')),
    ).toEqual([]);
  });

  test('A5 a row’s selection and a dialog’s scrim start nothing, the dialog’s entrance aside', async ({
    page,
  }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    await onCanvas(page, ['o', 'Enter'], 'Ellipse created. 1 element selected.');
    await DRAWER.open(page);
    await settled(page);
    await probeMotion(page);
    for (const key of ['End', 'Enter']) await page.keyboard.press(key);
    await expect(polite(page)).toHaveText('1 element selected.');
    await DRAWER.close(page);
    await settled(page);
    expect((await probed(page)).events).toEqual([]);
    await button(page, 'Pre-release').click();
    await settled(page);
    expect((await probed(page)).events).toEqual([
      'animationstart pw-enter-above #about-this-build',
      'animationend pw-enter-above #about-this-build',
    ]);
  });

  test('D4 a selection change, a re-render, a nudge and a camera step replay none of the panel’s entrance', async ({
    page,
  }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    await onCanvas(page, ['o', 'Enter'], 'Ellipse created. 1 element selected.');
    await settled(page);
    await probeMotion(page);
    await onCanvas(page, ['Control+a'], '2 elements selected.');
    const view = await readout(page).textContent();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Control+=');
    await expect(readout(page)).not.toHaveText(view ?? '');
    await expect(selectionSurface(page).getByRole('heading')).toHaveText('2 elements');
    await settled(page);
    expect((await probed(page)).events).toEqual([]);
  });

  test('A6 a menu item’s highlight fades its background in 90 ms by D2’s easing, and the focus ring shows at once', async ({
    page,
  }) => {
    await openPage(page);
    await MENU.open(page);
    await settled(page);
    await probeMotion(page);
    await page.getByRole('menuitem', { name: /^Zoom to fit/u }).hover();
    await settled(page);
    expect(
      (await probed(page)).events.filter((event) => event.startsWith('transitionrun')),
    ).toEqual(['transitionrun background-color .chrome-menu-item 90 cubic-bezier(0.2, 0, 0, 1)']);
    const RING = `(() => { const s = getComputedStyle(document.activeElement);
      return [s.outlineStyle, s.outlineColor, s.outlineWidth, s.boxShadow].join(' '); })()`;
    await page.keyboard.press('ArrowDown');
    const first = await page.evaluate<string>(RING);
    await settled(page);
    expect(await page.evaluate<string>(RING)).toBe(first);
    expect(first).toMatch(/^solid /u);
    const runs = (await probed(page)).events.filter((event) => event.startsWith('transitionrun'));
    expect(runs.filter((event) => !event.startsWith('transitionrun background-color '))).toEqual(
      [],
    );
  });

  test('A8 Enter on the menu button, then Enter again during its entrance, runs Select all and gives the focus back', async ({
    page,
  }) => {
    await holdEntrance(page, MENU.selector);
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    await onCanvas(page, ['o', 'Enter'], 'Ellipse created. 1 element selected.');
    await menuButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(MENU.selector)).toBeVisible();
    expect((await entrances(page)).map(({ target }) => target)).toEqual(['#chrome-menu']);
    await page.keyboard.press('Enter');
    await expect(polite(page)).toHaveText('2 elements selected.');
    await expect(menuButton(page)).toBeFocused();
    expect(await animations(page)).toEqual([]);
  });

  test('A8 the focus is in place in the frame that the menu, the drawer and the dialogs appear, before their entrance ends', async ({
    page,
  }) => {
    await openPage(page);
    for (const [selector, opener, focus] of [
      ['#chrome-menu', menuButton(page), /^Select all/u],
      ['#element-list-drawer', elementsToggle(page), /^Elements$/u],
      ['#about-this-build', button(page, 'Pre-release'), /^Close/u],
      ['#keyboard-shortcuts', button(page, 'Keyboard shortcuts'), /^Close/u],
    ] as const) {
      await opener.focus();
      await watchFirstFrame(page, selector);
      await page.keyboard.press('Enter');
      const frame = await firstFrame(page);
      expect(frame).toMatchObject({ focus: expect.stringMatching(focus), entering: true });
      await settled(page);
      await (selector === DRAWER.selector ? DRAWER.close(page) : escape(page));
      await expect(page.locator(selector)).toBeHidden();
    }
  });

  test('A8 Escape during an entrance closes the menu or a dialog at once, gives the focus back and leaves no animation', async ({
    page,
  }) => {
    await holdEntrance(page, MENU.selector);
    await holdEntrance(page, '#about-this-build');
    await openPage(page);
    for (const [selector, opener] of [
      [MENU.selector, menuButton(page)],
      ['#about-this-build', button(page, 'Pre-release')],
    ] as const) {
      await opener.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator(selector)).toBeVisible();
      expect((await entrances(page)).map(({ target }) => target)).toEqual([selector]);
      await escape(page);
      await expect(page.locator(selector)).toBeHidden();
      await expect(opener).toBeFocused();
      expect(await animations(page)).toEqual([]);
    }
  });

  test('A8 opening, closing and opening the menu again within its entrance leaves one animation and the settled box', async ({
    page,
  }) => {
    await holdEntrance(page, MENU.selector);
    await openPage(page);
    await menuButton(page).focus();
    for (const key of ['Enter', 'Escape', 'Enter']) await page.keyboard.press(key);
    await expect(page.locator(MENU.selector)).toBeVisible();
    expect(await entrances(page)).toEqual([
      { kind: 'CSSAnimation', name: 'pw-enter-above', target: '#chrome-menu' },
    ]);
    await release(page);
    const box = await settledBox(page, MENU.selector);
    await escape(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('Enter');
    expect(await settledBox(page, MENU.selector)).toEqual(box);
  });
});

test.describe('at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('A5 D4 the problem chip appears at once beside the notices’ entrance, which a failing save again replays not', async ({
    page,
  }) => {
    await refusableWrites(page);
    await openPage(page);
    await probeMotion(page);
    await showFailedNotice(page);
    await expect(saveStatus(page)).toBeVisible();
    await settled(page);
    await page.keyboard.press('ArrowRight');
    await settled(page);
    const events = (await probed(page)).events;
    expect(events.filter((event) => !event.includes('selection-panel'))).toEqual([
      'animationstart pw-enter-above #notices',
      'animationend pw-enter-above #notices',
    ]);
  });
});
