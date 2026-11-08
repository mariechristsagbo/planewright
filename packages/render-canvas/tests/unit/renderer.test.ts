import type { Element, OverlayPrimitive, RenderFrame, Renderer } from '@planewright/engine';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { CanvasSurface } from '../../src/canvas.ts';
import * as entry from '../../src/index.ts';
import { createCanvasRenderer } from '../../src/renderer.ts';
import { color, shape } from '../support/elements.ts';
import {
  fixedAdvanceMeasurer,
  pathFactory,
  RecordingPath,
  recordingCanvas,
  recordingContext,
} from '../support/recording.ts';

// The renderer port over two canvases (ADR 0006): the scene canvas under the overlay canvas, each
// backing store the CSS size times the device pixel ratio, each redrawn only when its frame part
// is present.

const box = shape('rectangle', { width: 100, height: 50 }, { x: 30, y: 40 });

function rendererOf() {
  const scene = recordingContext();
  const overlay = recordingContext();
  const sceneCanvas = recordingCanvas(scene.context);
  const overlayCanvas = recordingCanvas(overlay.context);
  const paths = pathFactory();
  const renderer = createCanvasRenderer({
    scene: sceneCanvas.canvas,
    overlay: overlayCanvas.canvas,
    measurer: fixedAdvanceMeasurer(),
    createPath: paths.createPath,
  });
  return { renderer, scene, overlay, sceneCanvas, overlayCanvas, paths };
}

const VIEW = {
  camera: { x: 10, y: 20, zoom: 2 },
  viewport: { width: 400, height: 300, pixelRatio: 2 },
  theme: 'light',
  background: color('#ffffff'),
} as const;

const sceneOf = (...elements: readonly Element[]): RenderFrame => ({
  ...VIEW,
  scene: { elements, hidden: [], removed: [] },
});

const overlayOf = (...primitives: readonly OverlayPrimitive[]): RenderFrame => ({
  ...VIEW,
  overlay: { primitives },
});

const MARQUEE: OverlayPrimitive = { type: 'marquee', box: { x: 0, y: 0, width: 10, height: 10 } };

describe('the canvas renderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AC leaves the scene canvas untouched by an overlay-only frame', () => {
    const { renderer, scene, overlay, sceneCanvas } = rendererOf();
    renderer.render(overlayOf(MARQUEE));
    expect(scene.calls).toEqual([]);
    expect(sceneCanvas.sizes).toEqual([]);
    expect(overlay.calls.map(([name]) => name)).toContain('fillRect');
  });

  it('leaves the overlay canvas untouched by a scene-only frame', () => {
    const { renderer, scene, overlay, overlayCanvas } = rendererOf();
    renderer.render(sceneOf(box));
    expect(overlay.calls).toEqual([]);
    expect(overlayCanvas.sizes).toEqual([]);
    expect(scene.calls.map(([name]) => name)).toContain('stroke');
  });

  it('AC sizes each backing store to the CSS size times the pixel ratio, assigning only changes', () => {
    const { renderer, sceneCanvas, overlayCanvas } = rendererOf();
    const viewport = { width: 401, height: 300.5, pixelRatio: 1.5 };
    const both: RenderFrame = { ...sceneOf(box), overlay: { primitives: [] }, viewport };
    renderer.render(both);
    renderer.render(both);
    expect(sceneCanvas.sizes).toEqual([
      ['width=', 602],
      ['height=', 451],
    ]);
    expect(overlayCanvas.sizes).toEqual(sceneCanvas.sizes);
    renderer.render({ ...both, viewport: { ...viewport, pixelRatio: 3 } });
    expect(sceneCanvas.sizes.slice(2)).toEqual([
      ['width=', 1203],
      ['height=', 902],
    ]);
  });

  it('draws the scene before the overlay, so an outline finds the drawing of the same frame', () => {
    const { renderer, overlay } = rendererOf();
    renderer.render({
      ...sceneOf(box),
      overlay: { primitives: [{ type: 'element-outline', element: box.id }] },
    });
    expect(overlay.calls).toContainEqual(['stroke', 'path 1']);
  });

  it('AC rebuilds a path only when its element’s revision changes, frame after frame', () => {
    const { renderer, paths } = rendererOf();
    renderer.render(sceneOf(box));
    renderer.render({ ...sceneOf(box), camera: { x: 0, y: 0, zoom: 1 } });
    expect(paths.made).toHaveLength(1);
    renderer.render(sceneOf({ ...box, width: 120, rev: 2 }));
    expect(paths.made).toHaveLength(2);
  });

  it('makes its paths with Path2D unless it is given a factory', () => {
    vi.stubGlobal(
      'Path2D',
      class extends RecordingPath {
        constructor() {
          super(0);
        }
      },
    );
    const scene = recordingContext();
    const renderer = createCanvasRenderer({
      scene: recordingCanvas(scene.context).canvas,
      overlay: recordingCanvas(recordingContext().context).canvas,
      measurer: fixedAdvanceMeasurer(),
    });
    renderer.render(sceneOf(box));
    expect(scene.calls).toContainEqual(['stroke', 'path 0']);
  });

  it('refuses a canvas that gives no 2D context', () => {
    const working = recordingCanvas(recordingContext().context).canvas;
    const broken = recordingCanvas(null).canvas;
    const options = { measurer: fixedAdvanceMeasurer() };
    expect(() => createCanvasRenderer({ ...options, scene: broken, overlay: working })).toThrow(
      /scene canvas gave no 2D context/,
    );
    expect(() => createCanvasRenderer({ ...options, scene: working, overlay: broken })).toThrow(
      /overlay canvas gave no 2D context/,
    );
  });

  it('refuses to render once disposed', () => {
    const { renderer, scene } = rendererOf();
    renderer.dispose();
    expect(() => {
      renderer.render(sceneOf(box));
    }).toThrow(/disposed/);
    expect(scene.calls).toEqual([]);
  });

  it("implements the engine's renderer port over a browser's canvases", () => {
    expectTypeOf(createCanvasRenderer).returns.toEqualTypeOf<Renderer>();
    expectTypeOf<HTMLCanvasElement>().toExtend<CanvasSurface>();
    expectTypeOf<OffscreenCanvas>().toExtend<CanvasSurface>();
  });
});

describe('the render-canvas entry point', () => {
  it('exports the renderer constructor and the font families as values', () => {
    expect(Object.keys(entry).sort()).toEqual([
      'FONT_STACKS',
      'canvasFont',
      'createCanvasRenderer',
    ]);
    expect(entry.createCanvasRenderer).toBe(createCanvasRenderer);
  });
});
