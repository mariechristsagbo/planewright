import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// The chrome's entrances as the end-to-end tests wait for them (ADR 0012, D2; the v0.2 plan's
// S12): a test that measures boxes or colours first waits for every animation of the page to end,
// since an entrance fades its surface in from transparent and translates it, and fails, naming
// them, if any still runs after a bound. Page code is written as strings, since these files compile
// without the DOM library.

/** How long a measurement waits for the page's animations to end: longer than any entrance. */
export const SETTLE_MS = 1000;

/** An animation as the tests name it: its kind, its keyframes or property, and its target. */
export interface Running {
  readonly kind: string;
  readonly name: string;
  readonly target: string;
}

/** Page code that names an animation, as Running, or an element. */
const DESCRIBE = `
  const nameOf = (element) => element === null || element === undefined ? 'none'
    : element.id !== '' ? '#' + element.id
    : element.tagName.toLowerCase() + [...element.classList].map((name) => '.' + name).join('');
  const describe = (animation) => ({
    kind: animation.constructor.name,
    name: animation.animationName ?? animation.transitionProperty ?? '',
    target: nameOf(animation.effect?.target) + (animation.effect?.pseudoElement ?? ''),
  });`;

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
