import { describe, expect, it } from 'vitest';

import { buildFrame, INITIAL_RENDER_STATE } from '../../../src/editor/frame.ts';
import type { RenderState } from '../../../src/editor/frame.ts';
import { overlayPrimitives } from '../../../src/editor/overlay.ts';
import { sceneOf, shapeElement, testId } from '../../support/elements.ts';

// Render frames (docs/architecture/engine/rendering-and-hit-testing.md#render-frame-and-renderer-port):
// data that carries the camera, the viewport, the theme and the background, plus a part for each
// layer that must be redrawn.

const below = shapeElement('rectangle', 100, 50, { id: 1, x: 30, y: 40, order: 'a' });
const above = shapeElement('ellipse', 20, 20, { id: 2, x: 60, y: 50, order: 'b' });
const offscreen = shapeElement('diamond', 10, 10, { id: 3, x: 5_000, y: 0 });

const STATE: RenderState = {
  ...INITIAL_RENDER_STATE,
  camera: { x: 10, y: 20, zoom: 2 },
  viewport: { width: 640, height: 480, pixelRatio: 2 },
  selection: [below.id],
};

const SCENE_ONLY = { scene: true, overlay: false, removed: [] } as const;
const OVERLAY_ONLY = { scene: false, overlay: true, removed: [] } as const;

describe('the initial render state', () => {
  it('shows the origin at zoom 1 on an empty viewport, lit, with nothing selected', () => {
    expect(INITIAL_RENDER_STATE).toStrictEqual({
      camera: { x: 0, y: 0, zoom: 1 },
      viewport: { width: 0, height: 0, pixelRatio: 1 },
      theme: 'light',
      selection: [],
      pointer: 'mouse',
      marquee: null,
      hidden: [],
    });
  });
});

describe('a render frame', () => {
  it("carries the state's camera, viewport and theme and the document's background", () => {
    const frame = buildFrame(sceneOf(below), { ...STATE, theme: 'dark' }, SCENE_ONLY);
    expect(frame.camera).toBe(STATE.camera);
    expect(frame.viewport).toBe(STATE.viewport);
    expect(frame.theme).toBe('dark');
    expect(frame.background).toBe('#ffffff');
  });

  it('redraws the scene layer with the visible elements in drawing order, and nothing else', () => {
    const scene = sceneOf(above, offscreen, below);
    const hidden = [above.id];
    const removed = [testId(7)];
    const frame = buildFrame(scene, { ...STATE, hidden }, { ...SCENE_ONLY, removed });
    expect(frame.scene).toStrictEqual({ elements: [below, above], hidden, removed });
    expect('overlay' in frame).toBe(false);
  });

  it('redraws only the overlay layer with its primitives when the scene layer is clean', () => {
    const scene = sceneOf(below);
    const frame = buildFrame(scene, STATE, OVERLAY_ONLY);
    expect(frame.overlay).toStrictEqual({ primitives: overlayPrimitives(scene, STATE) });
    expect(frame.overlay?.primitives[0]?.type).toBe('selection-outline');
    expect('scene' in frame).toBe(false);
  });

  it('redraws both layers when both are dirty', () => {
    const frame = buildFrame(sceneOf(below), STATE, { scene: true, overlay: true, removed: [] });
    expect(frame.scene?.elements).toStrictEqual([below]);
    expect(frame.overlay?.primitives).toHaveLength(10);
  });

  it('is plain data that survives a JSON round trip unchanged', () => {
    const frame = buildFrame(sceneOf(below, above), STATE, { ...SCENE_ONLY, overlay: true });
    expect(JSON.parse(JSON.stringify(frame))).toStrictEqual(frame);
  });
});
