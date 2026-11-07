import { createRenderLoop } from '../../src/editor/render-loop.ts';
import type { RenderLoop } from '../../src/editor/render-loop.ts';
import type { RenderFrame } from '../../src/editor/render-frame.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ChangeOrigin } from '../../src/scene/change-set.ts';
import type { SceneStore } from '../../src/scene/store.ts';
import { sceneOf } from './elements.ts';
import { createManualClock, createQueueScheduler } from './fakes.ts';
import type { QueueScheduler } from './fakes.ts';
import { changeSet } from './scene-state.ts';

// A render loop over a scene with a queue scheduler and one listener that keeps the frames, for
// the editor's dirty tracking and frame scheduling tests.

export interface LoopHarness {
  readonly store: SceneStore;
  readonly scheduler: QueueScheduler;
  readonly loop: RenderLoop;
  /** Runs the queued animation frames and returns the frames handed over since the last call. */
  readonly next: () => RenderFrame[];
  /** Moves an element right by `dx` with one change set of the given origin. */
  readonly move: (element: Element, dx: number, origin?: ChangeOrigin) => void;
}

/** A loop on an 800 × 600 viewport that has drawn its listener's full first frame: nothing is dirty. */
export function loopHarness(...elements: readonly Element[]): LoopHarness {
  const store = sceneOf(...elements);
  const scheduler = createQueueScheduler(createManualClock());
  const loop = createRenderLoop(store, scheduler);
  loop.update({ viewport: { width: 800, height: 600, pixelRatio: 1 } });
  const frames: RenderFrame[] = [];
  loop.onFrame((frame) => frames.push(frame));
  scheduler.frame();
  frames.length = 0;
  return {
    store,
    scheduler,
    loop,
    next: () => {
      scheduler.frame();
      return frames.splice(0);
    },
    move: (element, dx, origin = 'local') => {
      const x = store.get(element.id)?.x ?? element.x;
      const update = {
        type: 'update' as const,
        id: element.id,
        before: { x },
        after: { x: x + dx },
      };
      store.apply(changeSet([update]), origin);
    },
  };
}
