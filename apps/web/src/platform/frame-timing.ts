import type { RenderFrame, Renderer } from '@planewright/engine';

// The page's measurement of its frames (docs/architecture/engine/quality.md#what-eng-15-decided):
// a page opened with `?measure` in its address wraps each `render` in `performance.measure`, as
// the frame budgets B1 to B3 are read, named `planewright:render-scene` for a frame that redraws
// the scene layer (and the overlay with it) and `planewright:render-overlay` for one that redraws
// only the overlay. Without the parameter nothing is measured, so that no entry piles up in the
// page's performance timeline; with it, the page stops measuring after MEASURE_LIMIT renders,
// which keeps the timeline bounded on a page left open (the ENG-15 review's s4).

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

/**
 * How many renders a page opened to measure its frames measures, about three minutes of
 * rendering at 60 frames a second; each browser measurement opens its page again well within it.
 */
export const MEASURE_LIMIT = 10_000;

/** The renderer, with each of its first `limit` renders measured once it has drawn. */
export function timedRenderer(
  renderer: Renderer,
  timing: FrameTiming,
  limit = MEASURE_LIMIT,
): Renderer {
  let measured = 0;
  return {
    render(frame: RenderFrame) {
      if (measured >= limit) {
        renderer.render(frame);
        return;
      }
      const start = timing.now();
      renderer.render(frame);
      const end = timing.now();
      const layer = frame.scene === undefined ? 'overlay' : 'scene';
      const detail = {
        elements: frame.scene?.elements.length ?? 0,
        primitives: frame.overlay?.primitives.length ?? 0,
      };
      timing.measure(`planewright:render-${layer}`, { start, end, detail });
      measured += 1;
    },
    dispose() {
      renderer.dispose();
    },
  };
}
