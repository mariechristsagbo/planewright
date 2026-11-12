import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  DESCRIBE,
  EASE,
  animations,
  animationsLater,
  holdEntrance,
  literal,
  probeMotionAtLoad,
  probed,
  settled,
} from './motion.ts';
import type { Entrance, Running } from './motion.ts';
import { canvas } from './support.ts';

// An entrance of ADR 0012's D2 checked from end to end (the v0.2 plan's S12): opened with its
// animation held, then read and seeked with the Web Animations API at its start, half way and at
// its end; left to run and timed in the page; and, under reduced motion, absent from the start.
// Page code is written as strings, since these files compile without the DOM library.

/** A reading of an entering surface: its box, opacity, translation and layout offsets. */
interface Reading {
  readonly box: number[];
  readonly opacity: number;
  readonly translate: string;
  readonly offsets: number[];
  readonly islands: string[];
  readonly scroll: number[];
}

/** The entrance's timing and the surface read at its start, half way and at its end. */
interface Detail {
  readonly timing: Record<string, unknown>;
  readonly easing: string;
  readonly start: Reading;
  readonly half: Reading;
  readonly end: Reading;
  /** The animations once the entrance has finished. */
  readonly left: Running[];
}

interface Seeked {
  readonly own: Running[];
  readonly others: Running[];
  readonly detail: Detail | null;
}

/**
 * Finds the surface's animations, then pauses its one entrance and reads the surface at its start,
 * half way and at its end, which finish() reaches, with every other island's box and the window's
 * and the shell's scroll positions.
 */
const SEEK = (selector: string) => `(async () => {${DESCRIBE}
  const surface = document.querySelector(${literal(selector)});
  const all = document.getAnimations();
  const own = all.filter((animation) => animation.effect?.target === surface);
  const others = all.filter((animation) => !own.includes(animation)).map(describe);
  if (own.length !== 1) return { own: own.map(describe), others, detail: null };
  const [animation] = own;
  const { duration, delay, endDelay, iterations, fill, direction } = animation.effect.getComputedTiming();
  const shell = document.querySelector('.editor-shell');
  const islands = () => [...document.querySelectorAll('[data-island], #notices, #element-list-drawer, #details-sheet')]
    .filter((element) => !surface.contains(element))
    .map((element) => { const { x, y, width, height } = element.getBoundingClientRect(); return [nameOf(element), x, y, width, height].join(' '); });
  const read = () => {
    const { x, y, width, height } = surface.getBoundingClientRect();
    const style = getComputedStyle(surface);
    return {
      box: [x, y, width, height],
      opacity: Number(style.opacity),
      translate: style.translate,
      offsets: [surface.offsetLeft, surface.offsetTop, surface.offsetWidth, surface.offsetHeight],
      islands: islands(),
      scroll: [scrollX, scrollY, shell.scrollLeft, shell.scrollTop],
    };
  };
  animation.pause();
  animation.currentTime = 0;
  const start = read();
  animation.currentTime = duration / 2;
  const half = read();
  animation.finish();
  await animation.finished;
  const end = read();
  const timing = { duration, delay, endDelay, iterations, fill, direction };
  const easing = getComputedStyle(surface).animationTimingFunction;
  const left = document.getAnimations().map(describe);
  return { own: [describe(animation)], others, detail: { timing, easing, start, half, end, left } };
})()`;

/** Whether an animation is a menu item's highlight fading in, which D2 allows beside an entrance. */
const highlight = ({ kind, name, target }: Running): boolean =>
  kind === 'CSSTransition' && name === 'background-color' && target.includes('.chrome-menu-item');

/** Where a reading's box lies from the settled box, and its size beside the settled size. */
const offset = (reading: Reading, end: Reading): number[] =>
  reading.box.map((value, index) => Math.round((value - (end.box[index] ?? 0)) * 1000) / 1000);

/** Whether a value lies strictly between 0 and an end, or at 0 when the end is 0. */
const between = (value: number, end: number): boolean =>
  end === 0 ? value === 0 : value / end > 0 && value / end < 1;

/** D2's timing: its duration, no delay, one iteration, a fill that leaves nothing, its easing. */
function expectTiming({ timing, easing }: Detail, duration: number): void {
  expect(timing).toEqual({
    duration,
    delay: 0,
    endDelay: 0,
    iterations: 1,
    fill: expect.stringMatching(/^(backwards|none)$/u),
    direction: 'normal',
  });
  expect(easing).toBe(EASE);
}

/** Transparent at its start, shifted by D2's distance; between half way; settled at its end. */
function expectShift({ start, half, end, left }: Detail, [dx, dy]: Entrance['shift']): void {
  expect({ offset: offset(start, end), opacity: start.opacity }).toEqual({
    offset: [dx, dy, 0, 0],
    opacity: 0,
  });
  const [xh = 0, yh = 0] = offset(half, end);
  expect([between(xh, dx), between(yh, dy), between(half.opacity, 1)]).toEqual([true, true, true]);
  expect({ opacity: end.opacity, translate: end.translate }).toEqual({
    opacity: 1,
    translate: 'none',
  });
  expect(left.filter((each) => !highlight(each))).toEqual([]);
}

/** The surface's layout offsets, every other island's box and the scroll positions never change. */
function expectStable({ start, half, end }: Detail): void {
  for (const reading of [half, end]) {
    expect({ offsets: reading.offsets, islands: reading.islands }).toEqual({
      offsets: start.offsets,
      islands: start.islands,
    });
  }
  expect([start, half, end].map(({ scroll }) => scroll)).toEqual([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
}

/**
 * The surface's opening started exactly one CSS animation on it, a menu item's highlight aside,
 * with D2's duration and easing, no delay, one iteration and a fill that leaves nothing in effect;
 * seeked to its start it is transparent and shifted by exactly D2's distance in D2's direction,
 * half way it lies strictly between, and at its end it is opaque, untranslated and settled, while
 * its layout offsets, every other island's box and the scroll positions never change.
 */
export async function expectEntrance(
  page: Page,
  selector: string,
  { duration, shift }: Entrance,
): Promise<void> {
  const { own, others, detail } = await page.evaluate<Seeked>(SEEK(selector));
  expect(own.map(({ kind, name }) => kind + ' ' + name)).toEqual([
    expect.stringMatching(/^CSSAnimation pw-enter-/u),
  ]);
  expect(others.filter((each) => !highlight(each))).toEqual([]);
  if (detail === null) throw new Error(`No one entrance on ${selector}.`);
  expectTiming(detail, duration);
  expectShift(detail, shift);
  expectStable(detail);
  await settled(page);
}

/**
 * Starts timing, in the page, a surface's entrance left to run: from the first press or key after
 * now, or from its start if it comes at load, to its end.
 */
export const timeEntrance = async (page: Page, selector: string): Promise<void> => {
  await page.evaluate(`(() => {
    const timing = { from: null, to: null };
    window.motionTiming = timing;
    const begin = () => { timing.from ??= performance.now(); };
    for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, begin, true);
    document.addEventListener('animationstart', begin, true);
    document.addEventListener('animationend', (event) => {
      if (event.target.matches(${literal(selector)})) timing.to = performance.now();
    }, true);
  })()`);
};

/** The time that timeEntrance measured, once the entrance has ended, in milliseconds. */
export async function entranceTime(page: Page): Promise<number> {
  await expect
    .poll(() => page.evaluate<number | null>('window.motionTiming.to'), { timeout: 2000 })
    .not.toBeNull();
  return page.evaluate<number>('window.motionTiming.to - window.motionTiming.from');
}

/** The surface's box, once the page's animations have ended. */
export const settledBox = async (page: Page, selector: string): Promise<number[]> => {
  await settled(page);
  return page.evaluate<number[]>(`(() => {
    const { x, y, width, height } = document.querySelector(${literal(selector)}).getBoundingClientRect();
    return [x, y, width, height];
  })()`);
};

/** A surface of D2, how a test opens it and closes it, and how it opens again. */
export interface Surface {
  readonly selector: string;
  readonly entrance: Entrance;
  /** What happens before the page loads, such as making its storage fail. */
  readonly before?: (page: Page) => Promise<void>;
  /** Opens the surface on the loaded page; nothing, if it shows at load. */
  readonly open: (page: Page) => Promise<void>;
  readonly close: (page: Page) => Promise<void>;
  /** Opens it again after close, if not as open does. */
  readonly reopen?: (page: Page) => Promise<void>;
}

/**
 * Opens a surface with its entrance held at its start and checks it with expectEntrance, then
 * closes it, asks for reduced motion and opens it again, which shows it at once in the box where
 * it settled with motion.
 */
export async function checkEntrance(page: Page, surface: Surface): Promise<void> {
  const { selector, entrance, before, open, close, reopen = open } = surface;
  await holdEntrance(page, selector);
  await before?.(page);
  await page.goto('/');
  await expect(canvas(page)).toBeVisible();
  await open(page);
  await expect(page.locator(selector)).toBeVisible();
  await expectEntrance(page, selector, entrance);
  const box = await settledBox(page, selector);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await close(page);
  await expect(page.locator(selector)).toBeHidden();
  await reopen(page);
  await expect(page.locator(selector)).toBeVisible();
  expect(await animations(page)).toEqual([]);
  expect(await settledBox(page, selector)).toEqual(box);
}

/** Opens a surface with its entrance left to run, which ends within its duration and 500 ms. */
export async function checkEntranceTime(page: Page, surface: Surface): Promise<void> {
  await surface.before?.(page);
  await page.goto('/');
  await expect(canvas(page)).toBeVisible();
  await settled(page);
  await timeEntrance(page, surface.selector);
  await surface.open(page);
  expect(await entranceTime(page)).toBeLessThanOrEqual(surface.entrance.duration + 500);
}

/**
 * Opens a surface under reduced motion and checks that it shows at once: no animation in any task
 * that changed the page from its load, none two frames after it shows, and no motion event at all.
 */
export async function checkStill(page: Page, surface: Surface): Promise<void> {
  await probeMotionAtLoad(page);
  await surface.before?.(page);
  await page.goto('/');
  await expect(canvas(page)).toBeVisible();
  await surface.open(page);
  await expect(page.locator(surface.selector)).toBeVisible();
  const { events, tasks } = await probed(page);
  expect(tasks.length).toBeGreaterThan(0);
  expect({ events, tasks: tasks.filter((count) => count > 0) }).toEqual({ events: [], tasks: [] });
  expect(await animations(page)).toEqual([]);
  expect(await animationsLater(page)).toBe(0);
}
