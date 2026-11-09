import type { Element, RenderFrame } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { checkProperty } from '../../../engine/tests/support/property.ts';
import { createRandom } from '../../../engine/src/math/random.ts';
import { createPathCache } from '../../src/path-cache.ts';
import { drawScene } from '../../src/scene-layer.ts';
import { DEFAULT_STATE, replay, stateFor } from '../support/canvas-state.ts';
import type { Draw } from '../support/canvas-state.ts';
import { color, line, shape, text } from '../support/elements.ts';
import { prescribed } from '../support/prescribed.ts';
import { POINTS, SQUARE, sceneOf } from '../support/random-scenes.ts';
import {
  fixedAdvanceMeasurer,
  pathFactory,
  recordingCanvas,
  recordingContext,
} from '../support/recording.ts';

// The scene layer's drawing state (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer):
// no state saved per element, each property set only when it changes within a frame and set anew
// in every frame, and every drawing call made with exactly the state its element prescribes, as
// if each element were drawn in a state of its own saved from the defaults.

type SceneFrame = NonNullable<RenderFrame['scene']>;

const VIEW = {
  camera: { x: 10, y: 20, zoom: 2 },
  viewport: { width: 400, height: 300, pixelRatio: 2 },
  theme: 'light',
  background: color('#ffffff'),
} as const;

function painter() {
  const { context, calls } = recordingContext();
  const { canvas } = recordingCanvas(context);
  canvas.width = 800;
  canvas.height = 600;
  const cache = createPathCache(pathFactory().createPath, fixedAdvanceMeasurer());
  const draw = (elements: readonly Element[], view: Partial<RenderFrame> = {}) => {
    const part: SceneFrame = { elements, hidden: [], removed: [] };
    const from = calls.length;
    drawScene({ canvas, context }, { ...VIEW, ...view, scene: part }, part, cache);
    return calls.slice(from);
  };
  return { calls, cache, canvas, draw };
}

const CLEARING = [
  ['setTransform', 1, 0, 0, 1, 0, 0],
  ['clearRect', 0, 0, 800, 600],
  ['globalAlpha=', 1],
  ['fillStyle=', '#ffffff'],
  ['fillRect', 0, 0, 800, 600],
];

describe('the state the scene layer draws with', () => {
  it('AC never saves or restores the context, and sets a state again only when it changes', () => {
    const { draw } = painter();
    const twins = [1, 2].map((id) => shape('rectangle', SQUARE, { id, x: 10 * id }));
    expect(draw(twins)).toEqual([
      ...CLEARING,
      ['setTransform', 4, 0, 0, 4, 0, -80],
      ['strokeStyle=', '#1e2430'],
      ['lineWidth=', 2],
      ['setLineDash', []],
      ['lineCap=', 'butt'],
      ['lineJoin=', 'miter'],
      ['stroke', 'path 1'],
      ['setTransform', 4, 0, 0, 4, 40, -80],
      ['stroke', 'path 2'],
    ]);
  });

  it('sets the defaults that an element relies on again after another element changed them', () => {
    const { draw } = painter();
    const stroke = { color: color('#c92a2a'), width: 3, dash: 'dotted' } as const;
    const calls = draw([
      line(POINTS, { id: 1, style: { stroke } }),
      shape('ellipse', SQUARE, { id: 2 }),
    ]);
    const second = calls.slice(calls.findIndex(([name]) => name === 'stroke') + 1);
    expect(second).toEqual([
      ['setTransform', 4, 0, 0, 4, -40, -80],
      ['strokeStyle=', '#1e2430'],
      ['lineWidth=', 2],
      ['setLineDash', []],
      ['lineCap=', 'butt'],
      ['lineJoin=', 'miter'],
      ['stroke', 'path 2'],
    ]);
  });

  it('sets every state anew in each frame, so nothing that a frame left behind leaks', () => {
    const { draw } = painter();
    const faint = shape('rectangle', SQUARE, { style: { opacity: 0.4 } });
    draw([faint]);
    // The background is filled opaque although the last frame ended translucent, and the same
    // element sets its whole state again.
    expect(draw([faint], { viewport: { width: 400, height: 300, pixelRatio: 1 } })).toEqual([
      ...CLEARING,
      ['setTransform', 2, 0, 0, 2, -20, -40],
      ['globalAlpha=', 0.4],
      ['strokeStyle=', '#1e2430'],
      ['lineWidth=', 2],
      ['setLineDash', []],
      ['lineCap=', 'butt'],
      ['lineJoin=', 'miter'],
      ['stroke', 'path 1'],
    ]);
  });

  it('sets a font, an alignment and the baseline once for texts that share them', () => {
    const { draw } = painter();
    const notes = [1, 2].map((id) => text({ text: 'a' }, { id, x: 10 * id }));
    expect(draw(notes).slice(CLEARING.length)).toEqual([
      ['setTransform', 4, 0, 0, 4, 0, -80],
      ['font=', '20px "Planewright Sans", sans-serif'],
      ['textAlign=', 'left'],
      ['textBaseline=', 'middle'],
      ['fillStyle=', '#1e2430'],
      ['fillText', 'a', 0, 12.5],
      ['setTransform', 4, 0, 0, 4, 40, -80],
      ['fillText', 'a', 0, 12.5],
    ]);
  });
});

describe('every draw of the scene layer', () => {
  it('AC REQ-F01 draws with the state its element prescribes, frame after frame on one context', () => {
    checkProperty({ seed: 34, runs: 200 }, sceneOf, ({ frames }) => {
      const { calls, cache, canvas, draw } = painter();
      const expected: Draw[] = [];
      for (const { elements, view } of frames) {
        draw(elements, view);
        const frame: RenderFrame = { ...VIEW, ...view };
        const clearing = { ...DEFAULT_STATE, fillStyle: VIEW.background };
        expected.push(
          {
            call: ['clearRect', 0, 0, canvas.width, canvas.height],
            state: stateFor('clearRect', DEFAULT_STATE),
          },
          {
            call: ['fillRect', 0, 0, canvas.width, canvas.height],
            state: stateFor('fillRect', clearing),
          },
          ...elements.flatMap((element) => prescribed(cache, element, frame)),
        );
      }
      expect(replay(calls)).toEqual(expected);
    });
  });

  it('is checked on scenes of every kind and style, with new revisions and turns', () => {
    const random = createRandom(34);
    const scenes = Array.from({ length: 20 }, () => sceneOf(random));
    const elements = scenes.flatMap(({ frames }) => frames.flatMap((frame) => frame.elements));
    const seen = new Set(
      elements.flatMap(({ kind, rev, rotation, style }) => [
        kind,
        style.stroke.dash,
        `rev ${String(rev)}`,
        rotation === 0 ? 'unturned' : 'turned',
        style.opacity < 1 ? 'translucent' : 'opaque',
        style.fill === null ? 'unfilled' : 'filled',
      ]),
    );
    expect([...seen].sort()).toEqual(
      [
        'dashed',
        'diamond',
        'dotted',
        'ellipse',
        'filled',
        'freehand',
        'line',
        'opaque',
        'rectangle',
      ]
        .concat(['rev 1', 'rev 2', 'rev 3', 'rev 4', 'solid', 'text', 'translucent', 'turned'])
        .concat(['unfilled', 'unturned'])
        .sort(),
    );
  });
});
