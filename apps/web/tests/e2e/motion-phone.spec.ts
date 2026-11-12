import { expect, test } from '@playwright/test';

import { button, elementsToggle, openPage } from './a11y.ts';
import { moreButton, toolButton } from './drawing.ts';
import { checkEntrance, checkEntranceTime } from './entrance.ts';
import {
  animations,
  firstFrame,
  holdEntrance,
  probeMotion,
  probed,
  settled,
  watchFirstFrame,
} from './motion.ts';
import { startSession, tapDone } from './session.ts';
import { ELEMENTS_SHEET, MORE, PHONES, detailsButton, escape, rectangle } from './surfaces.ts';

// The entrances of ADR 0012's D2 on phones (the v0.2 plan's S12): in portrait the menu, More, the
// selection bar, the notices, Keyboard shortcuts from the menu and the two sheets, which rise from
// 16 px below; in landscape the panel and the side drawer. The focus, the inert islands, Escape and
// a press behave as before during an entrance, and a tip that opens inside an entering surface
// ends 8 px from its control (issue's D8).

for (const { width, height, surfaces } of PHONES) {
  test.describe(`at ${String(width)} × ${String(height)} with touch`, () => {
    test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

    for (const [name, surface] of surfaces) {
      test(`A3 A4 A9 ${name} enters once by opacity and translation over D2’s duration, settling where it shows under reduced motion`, async ({
        page,
      }) => {
        await checkEntrance(page, surface);
      });
    }
  });
}

/** The tip's distance from the focused control, its side, and the reach that bridges the gap. */
const TIP_GAP = `(() => {
  const tip = document.getElementById('chrome-tip').getBoundingClientRect();
  const control = document.activeElement.getBoundingClientRect();
  const side = document.getElementById('chrome-tip').dataset.side;
  const reach = parseFloat(document.getElementById('chrome-tip').style.getPropertyValue('--chrome-tip-reach'));
  return { side, gap: side === 'below' ? tip.top - control.bottom : control.top - tip.bottom, reach };
})()`;

test.describe('at 390 × 844 with touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const [name, surface] of [
    ['More’s popover', MORE],
    ['the Elements sheet', ELEMENTS_SHEET],
  ] as const) {
    test(`A4 ${name}’s entrance, left to run, ends within its duration and 500 ms`, async ({
      page,
    }) => {
      await checkEntranceTime(page, surface);
    });
  }

  test('A8 the focus is in place, and the sheet’s islands inert, in the frame that More, the Elements sheet and the Details sheet appear', async ({
    page,
  }) => {
    await openPage(page);
    await rectangle(page);
    await settled(page);
    // The first Escape closes the tip that the keyboard's focus opened on Hand or Close Details.
    for (const [selector, opener, focus, escapes] of [
      ['#more-tools', moreButton(page), /^Hand$/u, 2],
      ['#element-list-drawer', elementsToggle(page), /^Elements$/u, 1],
      ['#details-sheet', detailsButton(page), /^Close Details$/u, 2],
    ] as const) {
      await opener.focus();
      await watchFirstFrame(page, selector);
      await page.keyboard.press('Enter');
      const frame = await firstFrame(page);
      expect(frame).toMatchObject({ focus: expect.stringMatching(focus), entering: true });
      await settled(page);
      if (selector === '#element-list-drawer') {
        const inert = await page.evaluate<string[]>(
          `[...document.querySelectorAll('[inert]')].map((element) => element.closest('[data-island]').dataset.island)`,
        );
        expect(inert.length).toBeGreaterThan(0);
        expect(frame.inert).toEqual(inert);
      }
      for (let press = 0; press < escapes; press += 1) await escape(page);
      await expect(page.locator(selector)).toBeHidden();
      await expect(opener).toBeFocused();
    }
  });

  test('A8 Escape during an entrance closes More or a sheet at once, gives the focus back and leaves no animation', async ({
    page,
  }) => {
    for (const selector of ['#more-tools', '#element-list-drawer', '#details-sheet']) {
      await holdEntrance(page, selector);
    }
    await openPage(page);
    await rectangle(page);
    await settled(page);
    for (const [selector, opener, escapes] of [
      ['#more-tools', moreButton(page), 2],
      ['#element-list-drawer', elementsToggle(page), 1],
      ['#details-sheet', detailsButton(page), 2],
    ] as const) {
      await opener.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator(selector)).toBeVisible();
      expect((await animations(page)).map(({ target }) => target)).toEqual([selector]);
      // The first Escape closes the focus's tip, as S3 has it, the entrance still held.
      for (let press = 0; press < escapes; press += 1) await escape(page);
      await expect(page.locator(selector)).toBeHidden();
      await expect(opener).toBeFocused();
      expect(await animations(page)).toEqual([]);
    }
  });

  test('A8 a tap at the centre of the Elements sheet’s Close during its entrance closes it and draws nothing', async ({
    page,
  }) => {
    await holdEntrance(page, '#element-list-drawer');
    await openPage(page);
    await toolButton(page, 'Rectangle').tap();
    await elementsToggle(page).tap();
    await expect(page.locator('#element-list-drawer')).toBeVisible();
    expect(await animations(page)).toHaveLength(1);
    const close = await button(page, 'Close Elements').boundingBox();
    if (close === null) throw new Error('Close Elements is not laid out.');
    await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
    await expect(page.locator('#element-list-drawer')).toBeHidden();
    await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(elementsToggle(page).locator('.toggle-count')).toHaveText('0');
  });

  test('A10 a tip opened by the keyboard in More or in the Details sheet ends 8 px from its control once the entrance ends, its reach matching the gap', async ({
    page,
  }) => {
    await openPage(page);
    await rectangle(page);
    await settled(page);
    for (const [opener, name] of [
      [moreButton(page), /^Hand/u],
      [detailsButton(page), /^Close Details/u],
    ] as const) {
      await opener.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('tooltip')).toHaveText(name);
      await settled(page);
      const { side, gap, reach } = await page.evaluate<{
        side: string;
        gap: number;
        reach: number;
      }>(TIP_GAP);
      expect({ side, gap: Math.abs(gap - 8) <= 0.5, reach: Math.abs(reach - gap) < 0.01 }).toEqual({
        side: expect.stringMatching(/^(above|below)$/u),
        gap: true,
        reach: true,
      });
      await escape(page);
      await escape(page);
      await expect(opener).toBeFocused();
    }
  });

  test('A5 the Done bar, and history, zoom and the dock coming back after a text session, start nothing', async ({
    page,
  }) => {
    await openPage(page);
    await probeMotion(page);
    await startSession(page);
    await page.keyboard.type('Hi');
    await tapDone(page);
    await expect(toolButton(page, 'Rectangle')).toBeVisible();
    await settled(page);
    // The bar's own entrance aside, which the new text's selection mounts (a remount).
    expect((await probed(page)).events.filter((event) => !event.includes('selection-bar'))).toEqual(
      [],
    );
  });
});
