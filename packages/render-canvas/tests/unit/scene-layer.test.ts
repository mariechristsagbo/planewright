import type { Element, RenderFrame } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { createPathCache } from '../../src/path-cache.ts';
import { drawScene } from '../../src/scene-layer.ts';
import { arrow, color, freehand, id, line, shape, text } from '../support/elements.ts';
import type { Call } from '../support/recording.ts';
import {
  fixedAdvanceMeasurer,
  pathFactory,
  recordingCanvas,
  recordingContext,
} from '../support/recording.ts';

// Drawing the scene layer (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer):
// recorded draw calls for fixture scenes, compared with the sequences they must produce.

type SceneFrame = NonNullable<RenderFrame['scene']>;

const VIEW = {
  camera: { x: 10, y: 20, zoom: 2 },
  viewport: { width: 400, height: 300, pixelRatio: 2 },
  theme: 'light',
  background: color('#ffffff'),
} as const;

/** Draws a scene part with a fresh cache and returns the calls after the clearing ones. */
function drawn(scene: Partial<SceneFrame>, view: Partial<RenderFrame> = {}) {
  const { context, calls } = recordingContext();
  const { canvas } = recordingCanvas(context);
  canvas.width = 800;
  canvas.height = 600;
  const paths = pathFactory();
  const cache = createPathCache(paths.createPath, fixedAdvanceMeasurer());
  const part: SceneFrame = { elements: [], hidden: [], removed: [], ...scene };
  drawScene({ canvas, context }, { ...VIEW, ...view, scene: part }, part, cache);
  return { calls, paths, cache, elements: calls.slice(4) };
}

/** The calls that draw one element, given what its style sets between placing and painting. */
const element = (transform: Call, ...paint: Call[]): Call[] => [
  ['save'],
  transform,
  ...paint,
  ['restore'],
];

const STROKE: readonly Call[] = [
  ['strokeStyle=', '#1e2430'],
  ['lineWidth=', 2],
];

const box = shape('rectangle', { width: 100, height: 50 }, { x: 30, y: 40 });

describe('the scene layer', () => {
  it('AC clears to the background in device pixels, then draws in scene units at pixel ratio × zoom', () => {
    // At pixel ratio 2 and zoom 2 one scene unit is 4 device pixels; the box is 20 units right of
    // and 20 below the camera.
    expect(drawn({ elements: [box] }).calls).toEqual([
      ['setTransform', 1, 0, 0, 1, 0, 0],
      ['clearRect', 0, 0, 800, 600],
      ['fillStyle=', '#ffffff'],
      ['fillRect', 0, 0, 800, 600],
      ...element(['setTransform', 4, 0, 0, 4, 80, 80], ['globalAlpha=', 1], ...STROKE, [
        'stroke',
        'path 1',
      ]),
    ]);
  });

  it('AC scales the whole transform with the device pixel ratio', () => {
    const transform = (pixelRatio: number) =>
      drawn({ elements: [box] }, { viewport: { width: 400, height: 300, pixelRatio } }).elements[1];
    expect(transform(1)).toEqual(['setTransform', 2, 0, 0, 2, 40, 40]);
    expect(transform(2)).toEqual(['setTransform', 4, 0, 0, 4, 80, 80]);
    expect(transform(3)).toEqual(['setTransform', 6, 0, 0, 6, 120, 120]);
  });

  it('turns a rotated element about the centre of its local box', () => {
    const turned = shape('ellipse', { width: 100, height: 50 }, { x: 30, y: 40, rotation: 1 });
    expect(drawn({ elements: [turned] }).elements.slice(1, 5)).toEqual([
      ['setTransform', 4, 0, 0, 4, 80, 80],
      ['translate', 50, 25],
      ['rotate', 1],
      ['translate', -50, -25],
    ]);
  });

  it('fills a filled closed shape under its stroke', () => {
    const filled = shape(
      'diamond',
      { width: 10, height: 10 },
      {
        style: { fill: { color: color('#ffd8a8'), pattern: 'solid' } },
      },
    );
    expect(drawn({ elements: [filled] }).elements.slice(2, -1)).toEqual([
      ['globalAlpha=', 1],
      ['fillStyle=', '#ffd8a8'],
      ['fill', 'path 1'],
      ...STROKE,
      ['stroke', 'path 1'],
    ]);
  });

  it('draws lines and freehand strokes with round caps and joins, and never fills them', () => {
    const fill = { color: color('#ffd8a8'), pattern: 'solid' } as const;
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
    ];
    const paint = [['globalAlpha=', 1], ...STROKE, ['lineCap=', 'round'], ['lineJoin=', 'round']];
    expect(drawn({ elements: [line(points, { style: { fill } })] }).elements.slice(2, -1)).toEqual([
      ...paint,
      ['stroke', 'path 1'],
    ]);
    expect(drawn({ elements: [freehand(points)] }).elements.slice(2, -1)).toEqual([
      ...paint,
      ['stroke', 'path 1'],
    ]);
  });

  it('scales dashes with the stroke width', () => {
    const dashed = (dash: 'dashed' | 'dotted') =>
      drawn({
        elements: [
          shape(
            'rectangle',
            { width: 10, height: 10 },
            {
              style: { stroke: { color: color('#1e2430'), width: 3, dash } },
            },
          ),
        ],
      }).elements.find(([name]) => name === 'setLineDash');
    expect(dashed('dashed')).toEqual(['setLineDash', [12, 12]]);
    expect(dashed('dotted')).toEqual(['setLineDash', [3, 6]]);
  });

  it("fills a one-point stroke's disc with its stroke colour and does not stroke it", () => {
    expect(drawn({ elements: [freehand([{ x: 0, y: 0 }])] }).elements.slice(2, -1)).toEqual([
      ['globalAlpha=', 1],
      ['fillStyle=', '#1e2430'],
      ['fill', 'path 1'],
    ]);
  });

  it('applies opacity as the global alpha', () => {
    const faint = shape('rectangle', { width: 10, height: 10 }, { style: { opacity: 0.4 } });
    expect(drawn({ elements: [faint] }).elements[2]).toEqual(['globalAlpha=', 0.4]);
  });
});

describe('texts on the scene layer', () => {
  it('draw their laid-out lines in their stroke colour, each centred on its line', () => {
    const note = text({ text: 'one\ntwo', align: 'center' }, { x: 10, y: 20 });
    expect(drawn({ elements: [note] }).elements).toEqual(
      element(
        ['setTransform', 4, 0, 0, 4, 0, 0],
        ['globalAlpha=', 1],
        ['font=', '20px sans-serif'],
        ['textAlign=', 'center'],
        ['textBaseline=', 'middle'],
        ['fillStyle=', '#1e2430'],
        ['fillText', 'one', 50, 12.5],
        ['fillText', 'two', 50, 37.5],
      ),
    );
  });

  it('align to the left or right edge of their box and name a generic family until ENG-12', () => {
    const lines = (content: Parameters<typeof text>[0]) =>
      drawn({ elements: [text(content)] }).elements.filter(([name]) =>
        ['font=', 'fillText'].includes(name),
      );
    const font = { size: 16, lineHeight: 1.5 };
    expect(lines({ text: 'a', align: 'left', font: { family: 'hand', ...font } })).toEqual([
      ['font=', '16px cursive'],
      ['fillText', 'a', 0, 12],
    ]);
    expect(lines({ text: 'a', align: 'right', font: { family: 'mono', ...font } })).toEqual([
      ['font=', '16px monospace'],
      ['fillText', 'a', 100, 12],
    ]);
  });

  it('fill their box first when they have a fill', () => {
    const fill = { color: color('#fff3bf'), pattern: 'solid' } as const;
    const filled = drawn({ elements: [text({ text: 'a' }, { style: { fill } })] }).elements;
    expect(filled.slice(3, 5)).toEqual([
      ['fillStyle=', '#fff3bf'],
      ['fill', 'path 1'],
    ]);
  });
});

describe('what the scene layer draws', () => {
  it('skips hidden elements and kinds without geometry, and draws the rest bottom first', () => {
    const bottom = shape('rectangle', { width: 10, height: 10 }, { id: 1 });
    const hidden = text({ text: 'editing' }, { id: 2 });
    const top = shape('ellipse', { width: 10, height: 10 }, { id: 3 });
    const { elements, paths } = drawn({
      elements: [bottom, arrow({ id: 4 }), hidden, top],
      hidden: [hidden.id],
    });
    expect(elements.filter(([name]) => name === 'stroke')).toEqual([
      ['stroke', 'path 1'],
      ['stroke', 'path 2'],
    ]);
    expect(paths.made).toHaveLength(2);
  });

  it('drops removed elements from the cache before drawing, so a returning one is traced again', () => {
    const { context } = recordingContext();
    const { canvas } = recordingCanvas(context);
    const paths = pathFactory();
    const cache = createPathCache(paths.createPath, fixedAdvanceMeasurer());
    const before = shape('rectangle', { width: 10, height: 10 });
    const after: Element = { ...before, width: 30 };
    const frame = (scene: SceneFrame): RenderFrame => ({ ...VIEW, scene });
    const first = { elements: [before], hidden: [], removed: [] };
    drawScene({ canvas, context }, frame(first), first, cache);
    const second = { elements: [after], hidden: [], removed: [id(1)] };
    drawScene({ canvas, context }, frame(second), second, cache);
    expect(paths.made).toHaveLength(2);
    expect(paths.made[1]?.commands[1]).toEqual(['lineTo', 30, 0]);
  });

  it('keeps far-off content exact by placing each element relative to the camera', () => {
    const far = shape('rectangle', { width: 10, height: 10 }, { x: 1e9 - 90, y: -1e9 + 7 });
    const camera = { x: 1e9 - 100, y: -1e9, zoom: 1 };
    const viewport = { width: 400, height: 300, pixelRatio: 1 };
    expect(drawn({ elements: [far] }, { camera, viewport }).elements[1]).toEqual([
      'setTransform',
      1,
      0,
      0,
      1,
      10,
      7,
    ]);
  });
});
