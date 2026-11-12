import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { elementsToggle, openPage } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { checkStill } from './entrance.ts';
import {
  animations,
  animationsLater,
  probeMotion,
  probeMotionAtLoad,
  probed,
  settled,
} from './motion.ts';
import { DESKTOPS, MENU, PHONES, menuButton, rectangle } from './surfaces.ts';
import { canvas, readout } from './support.ts';

// Reduced motion and the camera (ADR 0012, D2; the v0.2 plan's S12): under prefers-reduced-motion:
// reduce no surface animates, in any layout, and no CSS animation or transition is even created,
// while the tooltip still waits 500 ms; with or without it, the camera never animates.

test.describe('with reduced motion requested', () => {
  test.use({ reducedMotion: 'reduce' });

  test.describe('at 1280 × 720', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('A1 opening the menu and then the drawer leaves document.getAnimations() empty, in the task of each opening and two frames later', async ({
      page,
    }) => {
      await probeMotionAtLoad(page);
      await openPage(page);
      await menuButton(page).click();
      await expect(page.locator('#chrome-menu')).toBeVisible();
      await elementsToggle(page).click();
      await expect(page.locator('#element-list-drawer')).toBeVisible();
      const { events, tasks } = await probed(page);
      expect(tasks.length).toBeGreaterThan(0);
      expect({ events, tasks: tasks.filter((count) => count > 0) }).toEqual({
        events: [],
        tasks: [],
      });
      expect(await page.evaluate('document.getAnimations().length')).toBe(0);
      expect(await animationsLater(page)).toBe(0);
    });

    test('A2 the four durations compute 0 ms, the tooltip’s delay 500 ms, and a hover tip opens 450 to 700 ms after the pointer rests', async ({
      page,
    }) => {
      await openPage(page);
      const values = await page.evaluate<string[]>(`(() => {
        const root = getComputedStyle(document.documentElement);
        return ['quick', 'enter', 'panel', 'sheet', 'delay-tooltip']
          .map((name) => root.getPropertyValue(name === 'delay-tooltip' ? '--pw-delay-tooltip' : '--pw-dur-' + name).trim());
      })()`);
      // The built style sheet writes 0ms as 0s, and 500ms as .5s.
      const zero = expect.stringMatching(/^0m?s$/u);
      expect(values).toEqual([zero, zero, zero, zero, expect.stringMatching(/^(500ms|\.5s)$/u)]);
      await page.evaluate(`void (window.hoverToTip = new Promise((resolve) => {
        const tip = document.getElementById('chrome-tip');
        let arrived = null;
        document.addEventListener('pointerover', (event) => {
          if (arrived === null && event.target.closest('[data-chrome-tip]') !== null) arrived = performance.now();
        }, true);
        new MutationObserver(() => {
          if (!tip.hidden && arrived !== null) resolve(performance.now() - arrived);
        }).observe(tip, { attributeFilter: ['hidden'] });
      }))`);
      const box = await toolButton(page, 'Ellipse').boundingBox();
      if (box === null) throw new Error('Ellipse is not laid out.');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const waited = await page.evaluate<number>('window.hoverToTip');
      expect([waited >= 450, waited <= 700]).toEqual([true, true]);
    });

    test('A2 a menu item’s hover and keyboard highlights create no transition', async ({
      page,
    }) => {
      await openPage(page);
      await MENU.open(page);
      await probeMotion(page);
      await page.getByRole('menuitem', { name: /^Zoom to fit/u }).hover();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      expect(await animations(page)).toEqual([]);
      expect(await animationsLater(page)).toBe(0);
      expect((await probed(page)).events).toEqual([]);
    });
  });

  for (const { width, height, touch, surfaces } of [...DESKTOPS, ...PHONES]) {
    test.describe(`at ${String(width)} × ${String(height)}${touch ? ' with touch' : ''}`, () => {
      test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch });

      for (const [name, surface] of surfaces) {
        test(`A2 ${name} shows at once, with no animation then or two frames later and no motion event`, async ({
          page,
        }) => {
          await checkStill(page, surface);
        });
      }
    });
  }
});

/** The view readout's text in each of ten animation frames after a command, and before it. */
interface Steps {
  readonly before: string;
  readonly seen: string[];
  readonly inside: number;
}

/**
 * Runs page code that sets the camera, then reads the view readout in each of the next ten
 * animation frames, and counts the animations whose target is inside the canvas's area.
 */
const STEPS = (act: string) => `new Promise((resolve) => {
  const readout = () => document.getElementById('view-readout').textContent;
  const before = readout();
  ${act};
  const seen = [];
  let inside = 0;
  const sample = () => {
    seen.push(readout());
    inside += document.getAnimations().filter((animation) => animation.effect?.target?.closest('.canvas-area')).length;
    if (seen.length < 10) requestAnimationFrame(sample); else resolve({ before, seen, inside });
  };
  requestAnimationFrame(sample);
})`;

const click = (selector: string) => `document.querySelector('${selector}').click()`;
const key = (init: string) =>
  `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ${init} }))`;
const WHEEL = `(() => {
  const host = document.querySelector('.canvas-host');
  const { x, y, width, height } = host.getBoundingClientRect();
  host.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100, clientX: x + width / 3, clientY: y + height / 3 }));
})()`;
const menuItem = (name: string) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent.startsWith('${name}')).click()`;

/** Expects a command's camera to show in the first frame and stay for ten frames. */
async function expectOneStep(page: Page, act: string): Promise<void> {
  const { before, seen, inside } = await page.evaluate<Steps>(STEPS(act));
  expect({ changed: seen[0] !== before, frames: new Set(seen).size, inside }).toEqual({
    changed: true,
    frames: 1,
    inside: 0,
  });
  await expect(readout(page)).toHaveText(seen[0] ?? '');
}

for (const motion of ['no-preference', 'reduce'] as const) {
  test.describe(`with ${motion === 'reduce' ? 'reduced motion' : 'no motion preference'} at 1280 × 720`, () => {
    test.use({ reducedMotion: motion, viewport: { width: 1280, height: 720 } });

    test('A7 each zoom by its button, the menu, its keys and the wheel changes the view in the first frame and not again', async ({
      page,
    }) => {
      await openPage(page);
      await rectangle(page);
      await settled(page);
      // A zoom in first, unchecked, so that each fit and reset has a view to change.
      const zoomIn = () => page.evaluate(click('button[aria-label="Zoom in"]'));
      for (const name of ['Zoom in', 'Zoom out', 'Zoom to fit', 'Reset zoom']) {
        if (name === 'Zoom to fit' || name === 'Reset zoom') await zoomIn();
        await expectOneStep(page, click(`button[aria-label^="${name}"]`));
      }
      for (const name of ['Zoom to fit', 'Reset zoom']) {
        await zoomIn();
        await menuButton(page).click();
        await settled(page);
        await expectOneStep(page, menuItem(name));
      }
      await canvas(page).focus();
      for (const init of [
        "key: '=', code: 'Equal', ctrlKey: true",
        "key: '-', code: 'Minus', ctrlKey: true",
        "key: '!', code: 'Digit1', shiftKey: true",
        "key: '0', code: 'Digit0', ctrlKey: true",
      ]) {
        if (init.includes('Digit')) await zoomIn();
        await canvas(page).focus();
        await expectOneStep(page, key(init));
      }
      await expectOneStep(page, WHEEL);
      expect(await animations(page)).toEqual([]);
    });

    test('A7 the canvas, its layers and the page set no animation, transition or smooth scrolling', async ({
      page,
    }) => {
      await openPage(page);
      const styles = await page.evaluate<string[]>(`(() => {
        const selectors = ['.canvas-area', '.canvas-stage', '.canvas-host', '.canvas-host canvas', '.text-layer', '.canvas-focus-ring'];
        return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
          const style = getComputedStyle(element);
          return [selector, style.animationName, style.transitionDuration].join(' ');
        }));
      })()`);
      expect(styles.length).toBeGreaterThanOrEqual(7);
      expect(styles.filter((style) => !style.endsWith(' none 0s'))).toEqual([]);
      expect(
        await page.evaluate<string[]>(
          `['html', 'body', '.editor-shell'].map((selector) => getComputedStyle(document.querySelector(selector)).scrollBehavior)`,
        ),
      ).toEqual(['auto', 'auto', 'auto']);
    });
  });
}
