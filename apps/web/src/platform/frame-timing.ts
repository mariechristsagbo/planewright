import type { RenderFrame, Renderer } from '@planewright/engine';

// The page's measurement of its frames (docs/architecture/engine/quality.md#what-eng-15-decided):
// a page opened with `?measure` in its address wraps each `render` in `performance.measure`, as
// the frame budgets B1 to B3 are read, named `planewright:render-scene` for a frame that redraws
// the scene layer (and the overlay with it) and `planewright:render-overlay` for one that redraws
// only the overlay. Without the parameter nothing is measured, so that no entry piles up in the
// page's performance timeline.

/** The parts of the page that the measurement reads. */
export interface MeasuringPage {
  readonly location: Pick<Location, 'search'>;
  readonly performance: Pick<Performance, 'now' | 'measure'>;
}

export type FrameTiming = MeasuringPage['performance'];

/** The page's clock and timeline when it was opened to measure its frames, otherwise null. */
export function frameTimingOf(page: MeasuringPage): FrameTiming | null {
  return new URLSearchParams(page.location.search).has('measure') ? page.performance : null;
}

/** The renderer, with each render measured once it has drawn. */
export function timedRenderer(renderer: Renderer, timing: FrameTiming): Renderer {
  return {
    render(frame: RenderFrame) {
      const start = timing.now();
      renderer.render(frame);
      const end = timing.now();
      const layer = frame.scene === undefined ? 'overlay' : 'scene';
      const detail = {
        elements: frame.scene?.elements.length ?? 0,
        primitives: frame.overlay?.primitives.length ?? 0,
      };
      timing.measure(`planewright:render-${layer}`, { start, end, detail });
    },
    dispose() {
      renderer.dispose();
    },
  };
}
