import type { OverlayPrimitive, RenderFrame } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import {
  HANDLE_FILL,
  MARQUEE_FILL,
  SELECTION_COLOR,
  drawOverlay,
} from '../../src/overlay-layer.ts';
import { createPathCache } from '../../src/path-cache.ts';
import type { PathCache } from '../../src/path-cache.ts';
import { color, id, shape } from '../support/elements.ts';
import type { Call } from '../support/recording.ts';
import {
  fixedAdvanceMeasurer,
  pathFactory,
  recordingCanvas,
  recordingContext,
} from '../support/recording.ts';

// Drawing the overlay layer (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-overlay-layer):
// screen-space primitives drawn in device pixels, with lines on whole device pixels.

const SQUARE = [
  { x: 40, y: 40 },
  { x: 240, y: 40 },
  { x: 240, y: 140 },
  { x: 40, y: 140 },
] as const;

interface Drawn {
  readonly pixelRatio?: number;
  /** Fills the cache before the overlay is drawn, as a scene frame would. */
  readonly prepare?: (cache: PathCache) => void;
}

function drawn(primitives: readonly OverlayPrimitive[], { pixelRatio = 1, prepare }: Drawn = {}) {
  const { context, calls } = recordingContext();
  const { canvas } = recordingCanvas(context);
  canvas.width = 640 * pixelRatio;
  canvas.height = 480 * pixelRatio;
  const paths = pathFactory();
  const cache = createPathCache(paths.createPath, fixedAdvanceMeasurer());
  prepare?.(cache);
  const frame: RenderFrame = {
    camera: { x: 10, y: 20, zoom: 2 },
    viewport: { width: 640, height: 480, pixelRatio },
    theme: 'light',
    background: color('#ffffff'),
    overlay: { primitives },
  };
  drawOverlay({ canvas, context }, frame, { primitives }, cache);
  return calls;
}

/** The calls that clear the overlay and set its pen, for a canvas of `width` × `height`. */
const clearing = (width: number, height: number, line: number): Call[] => [
  ['setTransform', 1, 0, 0, 1, 0, 0],
  ['clearRect', 0, 0, width, height],
  ['lineWidth=', line],
  ['strokeStyle=', SELECTION_COLOR],
];

describe('the overlay layer', () => {
  it('uses its own colours', () => {
    expect([SELECTION_COLOR, HANDLE_FILL, MARQUEE_FILL]).toEqual([
      '#2a62d0',
      '#ffffff',
      '#2a62d01a',
    ]);
  });

  it('AC clears in device pixels and outlines the selection with 1 px lines on pixel centres at ratio 1', () => {
    const outline: OverlayPrimitive = { type: 'selection-outline', corners: SQUARE };
    expect(drawn([outline])).toEqual([
      ...clearing(640, 480, 1),
      ['beginPath'],
      ['moveTo', 40.5, 40.5],
      ['lineTo', 240.5, 40.5],
      ['lineTo', 240.5, 140.5],
      ['lineTo', 40.5, 140.5],
      ['closePath'],
      ['stroke'],
    ]);
  });

  it('AC scales with the device pixel ratio: 2 px lines on whole pixels at ratio 2, 3 px on centres at 3', () => {
    const outline: OverlayPrimitive = { type: 'selection-outline', corners: SQUARE };
    const atTwo = drawn([outline], { pixelRatio: 2 });
    expect(atTwo.slice(0, 4)).toEqual(clearing(1280, 960, 2));
    expect(atTwo[5]).toEqual(['moveTo', 80, 80]);
    const atThree = drawn([outline], { pixelRatio: 3 });
    expect(atThree.slice(0, 4)).toEqual(clearing(1920, 1440, 3));
    expect(atThree[5]).toEqual(['moveTo', 120.5, 120.5]);
  });

  it('draws a handle as a white square of its size, and the rotation handle as a circle', () => {
    const handles: OverlayPrimitive[] = [
      { type: 'handle', handle: 'nw', center: { x: 40, y: 40 }, size: 8 },
      { type: 'handle', handle: 'rotate', center: { x: 140, y: 16 }, size: 8 },
    ];
    expect(drawn(handles, { pixelRatio: 2 }).slice(4)).toEqual([
      ['fillStyle=', HANDLE_FILL],
      ['fillRect', 72, 72, 16, 16],
      ['strokeRect', 72, 72, 16, 16],
      ['beginPath'],
      ['arc', 280, 32, 8, 0, 2 * Math.PI],
      ['fillStyle=', HANDLE_FILL],
      ['fill'],
      ['stroke'],
    ]);
  });

  it('fills and outlines the marquee on the device grid', () => {
    const marquee: OverlayPrimitive = {
      type: 'marquee',
      box: { x: 20, y: 20, width: 80, height: 20 },
    };
    expect(drawn([marquee]).slice(4)).toEqual([
      ['fillStyle=', MARQUEE_FILL],
      ['fillRect', 20.5, 20.5, 80, 20],
      ['strokeRect', 20.5, 20.5, 80, 20],
    ]);
  });

  it('outlines an element along its cached path in its own frame, one device pixel wide', () => {
    const box = shape('rectangle', { width: 100, height: 50 }, { x: 30, y: 40 });
    const calls = drawn([{ type: 'element-outline', element: box.id }], {
      pixelRatio: 2,
      prepare: (cache) => {
        cache.drawingOf(box);
      },
    });
    expect(calls.slice(4)).toEqual([
      ['save'],
      ['setTransform', 4, 0, 0, 4, 80, 80],
      ['lineWidth=', 0.5],
      ['stroke', 'path 1'],
      ['restore'],
    ]);
  });

  it('skips an element outline whose element it has not drawn', () => {
    expect(drawn([{ type: 'element-outline', element: id(9) }])).toEqual(clearing(640, 480, 1));
  });
});
