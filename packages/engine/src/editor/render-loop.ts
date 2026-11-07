import type { ViewportSize } from '../camera/viewport.ts';
import type { ElementId } from '../model/ids.ts';
import type { Cancel, Scheduler } from '../ports/ports.ts';
import { rethrowFirst } from '../scene/listener-errors.ts';
import type { SceneReader, SceneStore } from '../scene/store.ts';
import { buildFrame, INITIAL_RENDER_STATE } from './frame.ts';
import type { RenderState } from './frame.ts';
import type { RenderFrame } from './render-frame.ts';

// Dirty tracking and frame scheduling
// (docs/architecture/engine/rendering-and-hit-testing.md#dirty-layers-and-scheduling).

/**
 * The editor's render loop. It follows the scene and holds what the frames show besides it; a
 * change marks the layers that it affects dirty, and the first mark asks the scheduler for the
 * next animation frame, on which one frame is built and handed to every listener.
 */
export interface RenderLoop {
  /** What the frames show besides the document. */
  state(): RenderState;
  /** Changes what the frames show; each field given marks the layers that it affects dirty. */
  update(change: Partial<RenderState>): void;
  /** Marks both layers dirty, as a font that finished loading does. */
  invalidate(): void;
  /**
   * The frame that redraws the dirty layers, or null when none is; building it clears them. It
   * takes the marks that the next animation frame would hand to the listeners, so a loop is either
   * pulled or listened to: the editor only listens, and exposes no pull.
   */
  frame(): RenderFrame | null;
  /** Hands the listener every frame built on an animation frame, starting with a full one. */
  onFrame(listener: (frame: RenderFrame) => void): Cancel;
  /** Cancels the frame asked for and stops following the scene; the loop is then unusable. */
  dispose(): void;
}

type Layers = 'scene' | 'overlay' | 'both';

/** The layers that a change of each field marks dirty. */
const REDRAWS: Readonly<Record<keyof RenderState, Layers>> = {
  camera: 'both',
  viewport: 'both',
  theme: 'both',
  hidden: 'scene',
  selection: 'overlay',
  pointer: 'overlay',
  marquee: 'overlay',
};

const finite = (value: number): boolean => value >= 0 && value < Infinity;

/** The canvas host reports the viewport from the page, so it is checked at this boundary. */
function checkViewport({ width, height, pixelRatio }: ViewportSize): void {
  if (!(finite(width) && finite(height) && finite(pixelRatio) && pixelRatio > 0)) {
    throw new RangeError(
      `A viewport needs a finite width and height of 0 or more and a finite pixel ratio above 0, not ${String(width)} × ${String(height)} at ${String(pixelRatio)}.`,
    );
  }
}

/** The dirty layers, and the elements removed since the scene layer was last drawn. */
interface DirtyLayers {
  mark(layers: Layers): void;
  removed(id: ElementId): void;
  /** The frame that redraws the dirty layers, or null when none is; it clears the marks. */
  take(state: RenderState): RenderFrame | null;
}

function trackDirtyLayers(scene: SceneReader): DirtyLayers {
  const dirty = { scene: false, overlay: false };
  let removed = new Set<ElementId>();
  return {
    mark(layers) {
      if (layers !== 'overlay') dirty.scene = true;
      if (layers !== 'scene') dirty.overlay = true;
    },
    removed(id) {
      removed.add(id);
    },
    take(state) {
      if (!dirty.scene && !dirty.overlay) return null;
      const frame = buildFrame(scene, state, { ...dirty, removed: [...removed] });
      dirty.scene = dirty.overlay = false;
      removed = new Set();
      return frame;
    },
  };
}

type Listener = (frame: RenderFrame) => void;

/** Hands a frame to every listener, then rethrows the first error that one of them threw. */
function handOver(listeners: Iterable<{ readonly listener: Listener }>, frame: RenderFrame): void {
  const failures: unknown[] = [];
  for (const { listener } of [...listeners]) {
    try {
      listener(frame);
    } catch (error) {
      failures.push(error);
    }
  }
  rethrowFirst(failures);
}

/** Marks both layers dirty on every scene update, and notes the elements that it removes. */
function followScene(
  scene: SceneStore,
  dirty: DirtyLayers,
  mark: (layers: Layers) => void,
): Cancel {
  return scene.subscribe((update) => {
    for (const change of update.changes.elements) {
      if (change.type === 'remove') dirty.removed(change.element.id);
    }
    mark('both');
  });
}

/** A render loop over a scene store, which asks for animation frames through the scheduler. */
export function createRenderLoop(scene: SceneStore, scheduler: Scheduler): RenderLoop {
  let state = INITIAL_RENDER_STATE;
  const dirty = trackDirtyLayers(scene);
  const listeners = new Set<{ readonly listener: Listener }>();
  let pending: Cancel | null = null;
  let disposed = false;

  const alive = (): void => {
    if (disposed) throw new Error('This render loop has been disposed.');
  };
  const draw = (): void => {
    pending = null;
    const frame = dirty.take(state);
    if (frame !== null) handOver(listeners, frame);
  };
  const mark = (layers: Layers): void => {
    dirty.mark(layers);
    if (pending === null && listeners.size > 0) pending = scheduler.nextFrame(draw);
  };
  const cancelPending = (): void => {
    pending?.();
    pending = null;
  };
  const stop = followScene(scene, dirty, mark);

  return {
    state: () => state,
    update(change) {
      alive();
      if (change.viewport !== undefined) checkViewport(change.viewport);
      state = { ...state, ...change };
      for (const key of Object.keys(change) as (keyof RenderState)[]) mark(REDRAWS[key]);
    },
    invalidate() {
      alive();
      mark('both');
    },
    frame() {
      alive();
      return dirty.take(state);
    },
    onFrame(listener) {
      alive();
      const entry = { listener };
      listeners.add(entry);
      mark('both');
      return () => {
        listeners.delete(entry);
        // A frame that nobody hears would take the marks and removals that the next listener needs.
        if (listeners.size === 0) cancelPending();
      };
    },
    dispose() {
      disposed = true;
      stop();
      cancelPending();
      listeners.clear();
    },
  };
}
