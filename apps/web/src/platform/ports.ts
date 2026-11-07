import type { EditorPorts } from '@planewright/engine';

// The editor's ports over the browser (docs/architecture/engine/modules.md#ports): the page's
// clock, its timers and animation frames, and its random source for identifiers.

/** The parts of `window` that the ports use. */
export type BrowserPage = Pick<
  Window,
  'setTimeout' | 'clearTimeout' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'btoa'
> & {
  readonly performance: Pick<Performance, 'now'>;
  readonly crypto: Pick<Crypto, 'getRandomValues'>;
};

/** 128 random bits as 22 base64url characters, as the engine's identifiers are written. */
function randomId(page: BrowserPage): string {
  const bytes = page.crypto.getRandomValues(new Uint8Array(16));
  return page
    .btoa(String.fromCharCode(...bytes))
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');
}

export function browserPorts(page: BrowserPage): EditorPorts {
  return {
    clock: { now: () => page.performance.now() },
    scheduler: {
      after(delayMs, task) {
        const handle = page.setTimeout(task, delayMs);
        return () => {
          page.clearTimeout(handle);
        };
      },
      nextFrame(task) {
        const handle = page.requestAnimationFrame(task);
        return () => {
          page.cancelAnimationFrame(handle);
        };
      },
    },
    ids: { next: () => randomId(page) },
  };
}
