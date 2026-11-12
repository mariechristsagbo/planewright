import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// The chrome's entrances as the end-to-end tests read them (ADR 0012, D2; the v0.2 plan's S12):
// what animates, read and seeked with the Web Animations API rather than timed by the wall clock,
// the motion events counted from before an opening, and a wait for every entrance to end before a
// test measures boxes or colours. Page code is written as strings, since these files compile
// without the DOM library.

/** How long a measurement waits for the page's animations to end: longer than any entrance. */
export const SETTLE_MS = 1000;

/** An entrance of D2: its duration in ms, and its first frame's offset from the settled box. */
export interface Entrance {
  readonly duration: number;
  readonly shift: readonly [x: number, y: number];
}

/** The menu, the selection panel and bar, the notices and the dialogs: 140 ms, from 4 px above. */
export const ENTER: Entrance = { duration: 140, shift: [0, -4] };
/** More's popover, which rises out of the dock: 140 ms, from 4 px below. */
export const RISE: Entrance = { duration: 140, shift: [0, 4] };
/** The Elements drawer at its side: 180 ms, from 8 px toward the window's right edge. */
export const SIDE: Entrance = { duration: 180, shift: [8, 0] };
/** The Elements sheet and the Details sheet: 220 ms, from 16 px below. */
export const SHEET: Entrance = { duration: 220, shift: [0, 16] };

/** D2's easing, as the page computes it. */
export const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

/** An animation as the tests name it: its kind, its keyframes or property, and its target. */
export interface Running {
  readonly kind: string;
  readonly name: string;
  readonly target: string;
}

/** Page code that names an animation, as Running, or an element. */
export const DESCRIBE = `
  const nameOf = (element) => element === null || element === undefined ? 'none'
    : element.id !== '' ? '#' + element.id
    : element.tagName.toLowerCase() + [...element.classList].map((name) => '.' + name).join('');
  const describe = (animation) => ({
    kind: animation.constructor.name,
    name: animation.animationName ?? animation.transitionProperty ?? '',
    target: nameOf(animation.effect?.target) + (animation.effect?.pseudoElement ?? ''),
  });`;

/** The animations of the page, each named. */
export const animations = (page: Page): Promise<Running[]> =>
  page.evaluate<Running[]>(`(() => {${DESCRIBE}
    return document.getAnimations().map(describe);
  })()`);

/** Waits for the page's animations to end, at most SETTLE_MS, and gives those still running. */
const SETTLE = `(async () => {${DESCRIBE}
  const deadline = performance.now() + ${String(SETTLE_MS)};
  const later = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  while (document.getAnimations().length > 0 && performance.now() < deadline) {
    const ends = document.getAnimations().map((animation) => animation.finished.catch(() => undefined));
    await Promise.race([Promise.all(ends), later(deadline - performance.now())]);
  }
  return document.getAnimations().map(describe);
})()`;

/**
 * Waits until no animation runs in the page, so that boxes and colours read afterwards are the
 * settled ones, and fails, naming them, if any still runs after SETTLE_MS.
 */
export async function settled(page: Page): Promise<void> {
  const running = await page.evaluate<Running[]>(SETTLE);
  expect(running, `animations still running after ${String(SETTLE_MS)} ms`).toEqual([]);
}

/** The count of animations two animation frames after now. */
export const animationsLater = (page: Page): Promise<number> =>
  page.evaluate<number>(`new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve(document.getAnimations().length))))`);

/**
 * Starts counting, on the document from now, the events that animations and transitions fire, and
 * the animations that exist in each task that changes the page's elements, their hidden or open
 * attribute among them, read by a mutation observer at the end of that task.
 */
const PROBE = `(() => {
  const probe = { events: [], tasks: [] };
  window.motionProbe = probe;
  const types = ['animationstart', 'animationend', 'animationcancel', 'transitionrun', 'transitionstart', 'transitionend', 'transitioncancel'];
  const detail = (event) => {
    const name = event.animationName ?? event.propertyName;
    const on = event.target.id !== '' ? '#' + event.target.id : '.' + [...event.target.classList].join('.');
    if (event.type !== 'transitionrun') return [event.type, name, on].join(' ');
    const transition = event.target.getAnimations().find((each) => each.transitionProperty === name);
    const timing = transition?.effect.getComputedTiming();
    return [event.type, name, on, timing?.duration, timing?.easing].join(' ');
  };
  for (const type of types) document.addEventListener(type, (event) => probe.events.push(detail(event)), true);
  new MutationObserver(() => probe.tasks.push(document.getAnimations().length))
    .observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open'] });
})()`;

export const probeMotion = async (page: Page): Promise<void> => {
  await page.evaluate(PROBE);
};

/** Probes from the page's start, before any of its scripts runs. */
export async function probeMotionAtLoad(page: Page): Promise<void> {
  await page.addInitScript(PROBE);
}

/** What the probe counted: the events, and the animations at the end of each changing task. */
export const probed = (page: Page): Promise<{ events: string[]; tasks: number[] }> =>
  page.evaluate<{ events: string[]; tasks: number[] }>('window.motionProbe');

/**
 * Holds a surface's entrances at their start: at the end of each task that changes the page's
 * elements, or their hidden or open attribute, the surface's CSS animations are created, if they
 * are not yet, and paused at time 0, so that a test can read and seek them however long its own
 * steps, or the page's first frame, take. Installed before the page's scripts.
 */
export async function holdEntrance(page: Page, selector: string): Promise<void> {
  await page.addInitScript(`new MutationObserver(() => {
    for (const surface of document.querySelectorAll(${JSON.stringify(selector)})) {
      for (const animation of surface.getAnimations()) {
        if (animation.animationName === undefined || animation.playState === 'paused') continue;
        animation.pause();
        animation.currentTime = 0;
      }
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open'] })`);
}

/** The held entrances, played on to their end. */
export const release = async (page: Page): Promise<void> => {
  await page.evaluate(`document.getAnimations().forEach((animation) => animation.play())`);
};

/** What the page showed in the first animation frame in which a surface was laid out. */
export interface FirstFrame {
  readonly focus: string;
  readonly entering: boolean;
  readonly inert: string[];
}

/**
 * Watches, from the next animation frame on, for the first frame in which the surface is laid out,
 * and records there the focused element's name, whether the surface's entrance is still running,
 * and the islands made inert.
 */
export const watchFirstFrame = async (page: Page, selector: string): Promise<void> => {
  await page.evaluate(`(() => {
    window.motionFirst = null;
    const named = (element) => element.getAttribute('aria-labelledby')?.split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    const label = (element) => element === null ? 'none'
      : element.getAttribute('aria-label') ?? named(element) ?? element.textContent.trim().slice(0, 30);
    const look = () => {
      const surface = document.querySelector(${JSON.stringify(selector)});
      if (surface === null || surface.getClientRects().length === 0) return requestAnimationFrame(look);
      const entering = surface.getAnimations().some((animation) =>
        (animation.currentTime ?? 0) < animation.effect.getComputedTiming().duration);
      const inert = [...document.querySelectorAll('[inert]')]
        .map((element) => element.closest('[data-island]')?.dataset.island ?? element.id);
      window.motionFirst = { focus: label(document.activeElement), entering, inert };
    };
    requestAnimationFrame(look);
  })()`);
};

/** The first frame that watchFirstFrame recorded, once there is one. */
export async function firstFrame(page: Page): Promise<FirstFrame> {
  await expect.poll(() => page.evaluate<unknown>('window.motionFirst')).not.toBeNull();
  return page.evaluate<FirstFrame>('window.motionFirst');
}
