import type { RenderFrame, Renderer } from '@planewright/engine';
import { describe, expect, it, vi } from 'vitest';

import { frameTimingOf, timedRenderer } from '../../src/platform/frame-timing.ts';

// The page's measurement of its frames (docs/architecture/engine/quality.md#what-eng-15-decided):
// opened with `?measure`, it wraps each `render` in `performance.measure`, named for the layers
// the frame redraws, so that the browser measurements read B1 to B3; opened without it, it
// measures nothing.

function pageAt(search: string) {
  let time = 10;
  const measure = vi.fn();
  return {
    location: { search },
    performance: { now: () => (time += 2.5), measure },
    measure,
  };
}

const SCENE_FRAME = {
  scene: { elements: [{}, {}, {}], hidden: [], removed: [] },
  overlay: { primitives: [] },
} as unknown as RenderFrame;
const OVERLAY_FRAME = { overlay: { primitives: [{}, {}] } } as unknown as RenderFrame;

describe('frameTimingOf', () => {
  it('measures nothing on a page opened without ?measure', () => {
    expect(frameTimingOf(pageAt(''))).toBeNull();
    expect(frameTimingOf(pageAt('?measured=1'))).toBeNull();
  });

  it('measures on a page opened with ?measure, among other parameters too', () => {
    expect(frameTimingOf(pageAt('?measure'))).not.toBeNull();
    expect(frameTimingOf(pageAt('?a=1&measure'))).not.toBeNull();
  });
});

describe('timedRenderer', () => {
  it('draws each frame and measures its render, named for the scene or the overlay layer', () => {
    const page = pageAt('?measure');
    const timing = frameTimingOf(page);
    if (timing === null) throw new Error('The page measures.');
    const render = vi.fn<Renderer['render']>();
    const dispose = vi.fn<Renderer['dispose']>();
    const renderer = timedRenderer({ render, dispose }, timing);
    renderer.render(SCENE_FRAME);
    renderer.render(OVERLAY_FRAME);
    expect(render).toHaveBeenNthCalledWith(1, SCENE_FRAME);
    expect(render).toHaveBeenNthCalledWith(2, OVERLAY_FRAME);
    expect(page.measure.mock.calls).toEqual([
      [
        'planewright:render-scene',
        { start: 12.5, end: 15, detail: { elements: 3, primitives: 0 } },
      ],
      [
        'planewright:render-overlay',
        { start: 17.5, end: 20, detail: { elements: 0, primitives: 2 } },
      ],
    ]);
    renderer.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('measures nothing when the render throws, and lets the error go on', () => {
    const page = pageAt('?measure');
    const timing = frameTimingOf(page);
    if (timing === null) throw new Error('The page measures.');
    const failing: Renderer = {
      render: () => {
        throw new Error('no context');
      },
      dispose: () => undefined,
    };
    expect(() => {
      timedRenderer(failing, timing).render(SCENE_FRAME);
    }).toThrow('no context');
    expect(page.measure).not.toHaveBeenCalled();
  });
});
