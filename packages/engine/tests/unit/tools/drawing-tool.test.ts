import { describe, expect, it } from 'vitest';

import { drawingTool } from '../../../src/tools/drawing-tool.ts';
import type { DrawnKind } from '../../../src/tools/new-elements.ts';
import { testId } from '../../support/elements.ts';
import { toolRun } from '../../support/tool-runs.ts';
import { boxOf } from '../../support/transform-scene.ts';

// The rectangle, ellipse, diamond and line tools' reducer, over a scene that their previews change
// (ENG-11). B-01's drags and boxes are the numbers committed in behavior-analysis.md; at the
// starting camera a screen point is the scene point.

const NEW = testId(101);

/** The box [x, y, width, height] and the points, if any, of the element a run drew. */
function drawn(run: ReturnType<typeof toolRun>) {
  const element = run.scene.get(NEW);
  if (element === undefined) throw new Error('Nothing was drawn.');
  return { box: boxOf(element), points: 'points' in element ? element.points : undefined };
}

function drawBy(kind: DrawnKind, ...points: readonly (readonly [number, number])[]) {
  const run = toolRun(drawingTool(kind));
  run.drag(...points);
  return drawn(run);
}

describe('REQ-C01 B-01: a drag draws the element over exactly its extent', () => {
  it.each([
    ['rectangle', [300, 180, 420, 280], [300, 180, 120, 100]],
    ['ellipse', [520, 180, 660, 280], [520, 180, 140, 100]],
    ['diamond', [820, 170, 940, 290], [820, 170, 120, 120]],
    ['line', [300, 420, 420, 420], [300, 420, 120, 0]],
  ] as const)('the %s drag %j gives %j', (kind, [x0, y0, x1, y1], box) => {
    expect(drawBy(kind, [x0, y0], [x0 + 10, y0 + 10], [x1, y1]).box).toEqual(box);
  });

  it('the line runs from the press to the release', () => {
    expect(drawBy('line', [300, 420], [320, 420], [420, 420]).points).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
    ]);
  });

  it('the release point ends the drag', () => {
    expect(drawBy('rectangle', [300, 180], [350, 220], [420, 280]).box).toEqual([
      300, 180, 120, 100,
    ]);
    const run = toolRun(drawingTool('ellipse'));
    run.at('press', 520, 180);
    run.at('drag-start', 600, 250);
    run.at('release', 660, 280);
    expect(drawn(run).box).toEqual([520, 180, 140, 100]);
  });
});

describe('REQ-C02 B-01 drags in every direction give the same normalised boxes', () => {
  const B01 = [
    ['rectangle', [300, 180, 420, 280]],
    ['ellipse', [520, 180, 660, 280]],
    ['diamond', [820, 170, 940, 290]],
  ] as const;
  it.each(B01)('the %s box %j from each of its corners', (kind, [left, top, right, bottom]) => {
    const box = [left, top, right - left, bottom - top];
    const corners: readonly (readonly [number, number, number, number])[] = [
      [right, bottom, left, top],
      [right, top, left, bottom],
      [left, bottom, right, top],
    ];
    for (const [x0, y0, x1, y1] of corners) {
      expect(drawBy(kind, [x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1]).box).toEqual(box);
    }
  });

  it('a line drawn towards the top-left keeps its start at the press', () => {
    expect(drawBy('line', [420, 280], [400, 260], [300, 180])).toEqual({
      box: [300, 180, 120, 100],
      points: [
        { x: 120, y: 100 },
        { x: 0, y: 0 },
      ],
    });
  });

  it('a flat drag gives a closed shape a side of 1 unit, and a line keeps its height of 0', () => {
    expect(drawBy('rectangle', [300, 180], [320, 180], [420, 180]).box).toEqual([300, 180, 120, 1]);
    expect(drawBy('diamond', [300, 180], [300, 160], [300, 80]).box).toEqual([300, 80, 1, 100]);
    expect(drawBy('line', [420, 180], [320, 180], [300, 180]).box).toEqual([300, 180, 120, 0]);
  });

  it('draws in scene units under a panned and zoomed camera, with no snapping', () => {
    const run = toolRun(drawingTool('rectangle'), { camera: { x: 100, y: 50, zoom: 2 } });
    run.drag([101, 99], [151, 149], [301, 200]);
    expect(drawn(run).box).toEqual([150.5, 99.5, 100, 50.5]);
  });
});

describe('REQ-C03 REQ-C04 a tap draws the default size, centred on it', () => {
  it.each(['rectangle', 'ellipse', 'diamond'] as const)('a tapped %s is 100 x 100', (kind) => {
    const run = toolRun(drawingTool(kind));
    run.at('press', 400, 300);
    run.at('tap', 400, 300);
    expect(drawn(run).box).toEqual([350, 250, 100, 100]);
  });

  it('a tapped line is horizontal and 100 long', () => {
    const run = toolRun(drawingTool('line'), { camera: { x: 10, y: 20, zoom: 0.5 } });
    run.at('tap', 400, 300);
    expect(drawn(run)).toEqual({
      box: [760, 620, 100, 0],
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    });
  });

  it('a double tap draws as a tap does', () => {
    const run = toolRun(drawingTool('ellipse'));
    run.at('double-tap', 400, 300);
    expect(drawn(run).box).toEqual([350, 250, 100, 100]);
  });
});
