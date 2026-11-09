import { afterEach, describe, expect, it } from 'vitest';

import { SAY_DELAY_MS, createLiveRegion } from '../../src/a11y/live-region.ts';

// The live region (docs/architecture/engine/quality.md#accessibility, REQ-Y04): a polite region and
// an assertive one, in the page from start-up, each emptied before its next message is written, so
// that assistive technology announces a repeated message again.

/** A scheduler whose delayed tasks run only when the test says so. */
function manualTimers() {
  const tasks = new Set<() => void>();
  const delays: number[] = [];
  return {
    after: (ms: number, task: () => void) => {
      delays.push(ms);
      tasks.add(task);
      return () => {
        tasks.delete(task);
      };
    },
    run: () => {
      for (const task of [...tasks]) {
        tasks.delete(task);
        task();
      }
    },
    delays,
  };
}

const region = (urgency: string) => document.getElementById(`live-${urgency}`);

afterEach(() => {
  document.body.replaceChildren();
});

describe('the live region', () => {
  it('REQ-Y04 puts an empty polite and an empty assertive region in the page, hidden from view', () => {
    createLiveRegion(document, manualTimers());
    for (const urgency of ['polite', 'assertive']) {
      const live = region(urgency);
      expect(live?.getAttribute('aria-live')).toBe(urgency);
      expect(live?.getAttribute('aria-atomic')).toBe('true');
      expect(live?.getAttribute('role')).toBeNull();
      expect(live?.className).toBe('visually-hidden');
      expect(live?.textContent).toBe('');
    }
  });

  it('REQ-Y04 empties a region at once and writes its message after a pause, so a repeat is said again', () => {
    const timers = manualTimers();
    const live = createLiveRegion(document, timers);
    live.say('1 element selected.', 'polite');
    expect(region('polite')?.textContent).toBe('');
    timers.run();
    expect(region('polite')?.textContent).toBe('1 element selected.');
    live.say('1 element selected.', 'polite');
    expect(region('polite')?.textContent).toBe('');
    timers.run();
    expect(region('polite')?.textContent).toBe('1 element selected.');
    expect([SAY_DELAY_MS, timers.delays]).toEqual([100, [100, 100]]);
  });

  it('REQ-Y04 writes only the latest of messages said within the pause, each region on its own', () => {
    const timers = manualTimers();
    const live = createLiveRegion(document, timers);
    live.say('Rectangle created.', 'polite');
    live.say('Saving failed.', 'assertive');
    live.say('Nothing selected.', 'polite');
    timers.run();
    expect([region('polite')?.textContent, region('assertive')?.textContent]).toEqual([
      'Nothing selected.',
      'Saving failed.',
    ]);
  });
});
