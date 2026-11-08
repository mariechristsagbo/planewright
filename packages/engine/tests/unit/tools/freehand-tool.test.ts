import { describe, expect, it } from 'vitest';

import { INITIAL_DEFAULT_STYLE } from '../../../src/model/defaults.ts';
import { LIMITS } from '../../../src/model/limits.ts';
import {
  FREEHAND_POINT_LIMIT,
  freehandTool,
  strokingTool,
} from '../../../src/tools/freehand-tool.ts';
import { testId } from '../../support/elements.ts';
import { toolRun } from '../../support/tool-runs.ts';
import { boxOf } from '../../support/transform-scene.ts';

// The freehand tool's reducer, over a scene that its previews change (ENG-11). B-05's stroke is the
// committed 6-vertex drag from (520,400) to (620,440), whose box is the input's extent.

const NEW = testId(101);
const OLD = testId(1);

function stroke(run: ReturnType<typeof toolRun>) {
  const element = run.scene.get(NEW);
  if (element?.kind !== 'freehand') throw new Error('No stroke was drawn.');
  return { box: boxOf(element), points: element.points };
}

describe('REQ-C07 a freehand stroke', () => {
  it('B-05: its box is the extent of its input, and its points are measured from the box', () => {
    const run = toolRun(freehandTool);
    run.drag([520, 400], [540, 420], [560, 440], [580, 410], [600, 430], [620, 440]);
    expect(stroke(run)).toEqual({
      box: [520, 400, 100, 40],
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 40, y: 40 },
        { x: 60, y: 10 },
        { x: 80, y: 30 },
        { x: 100, y: 40 },
      ],
    });
  });

  it('takes a point whenever the pointer has moved 1 screen pixel from the last one', () => {
    const run = toolRun(freehandTool);
    run.drag(
      [100, 100],
      [104, 100],
      [104.5, 100],
      [105, 100],
      [105, 100.5],
      [105.75, 100.5],
      [108, 104],
    );
    expect(stroke(run).points.map(({ x }) => x)).toEqual([0, 4, 5, 8]);
  });

  it('measures the spacing on screen, so a zoomed stroke keeps finer scene points', () => {
    const run = toolRun(freehandTool, { camera: { x: 0, y: 0, zoom: 2 } });
    run.drag([100, 100], [104, 100], [105, 100], [105.5, 100], [106, 100]);
    expect(stroke(run)).toMatchObject({ box: [50, 50, 3, 0] });
    expect(stroke(run).points.map(({ x }) => x)).toEqual([0, 2, 2.5, 3]);
  });

  it('the release takes its point too', () => {
    const run = toolRun(freehandTool);
    run.at('press', 100, 100);
    run.at('drag-start', 110, 100);
    run.at('release', 130, 120);
    expect(stroke(run).box).toEqual([100, 100, 30, 20]);
  });

  it('a tap makes a dot of zero size at the tap', () => {
    const run = toolRun(freehandTool, { camera: { x: 10, y: 20, zoom: 2 } });
    run.at('press', 400, 300);
    run.at('tap', 400, 300);
    expect(stroke(run)).toEqual({ box: [210, 170, 0, 0], points: [{ x: 0, y: 0 }] });
  });

  it('takes the default style with sharp corners', () => {
    const run = toolRun(freehandTool);
    run.at('tap', 400, 300);
    expect(run.scene.get(NEW)?.style).toEqual({ ...INITIAL_DEFAULT_STYLE, corners: 'sharp' });
  });
});

describe('REQ-C06 the freehand tool stays active and leaves nothing selected', () => {
  for (const toolLock of [false, true]) {
    it(`commits one step and asks for no selection or tool change, with tool lock ${toolLock ? 'on' : 'off'}`, () => {
      const run = toolRun(freehandTool, { toolLock, selected: [OLD] });
      run.drag([100, 100], [110, 110], [130, 120]);
      // The release at the last point takes no point, so it previews nothing.
      expect(run.run.effects.map(({ type }) => type)).toEqual([
        'select',
        'preview',
        'preview',
        'commit',
      ]);
      expect(run.run.effects.at(-1)).toEqual({ type: 'commit', label: 'create' });
      expect(run.run.selection).toEqual([]);
      expect(run.at('tap', 300, 300).map(({ type }) => type)).toEqual([
        'select',
        'preview',
        'commit',
      ]);
    });
  }

  it('a cancel reverts the stroke, and a press released without a drag draws nothing', () => {
    const run = toolRun(freehandTool);
    run.at('press', 100, 100);
    expect(run.at('release', 100, 100)).toEqual([]);
    run.at('press', 100, 100);
    run.at('drag-start', 110, 110);
    expect(run.cancel()).toEqual([{ type: 'cancel' }]);
    expect(run.at('drag', 120, 120)).toEqual([]);
  });
});

describe('the freehand limits', () => {
  it('takes no point past the document limit of points', () => {
    expect(FREEHAND_POINT_LIMIT).toBe(LIMITS.freehandPoints);
    const run = toolRun(strokingTool(3));
    run.drag([100, 100], [110, 100], [120, 100], [130, 100], [140, 100]);
    expect(stroke(run).points).toHaveLength(3);
    expect(stroke(run).box).toEqual([100, 100, 20, 0]);
  });

  it('a point past the coordinate limit is not taken', () => {
    const run = toolRun(freehandTool, { camera: { x: -1e9 + 100, y: 0, zoom: 1 } });
    run.drag([200, 100], [150, 100], [-500, 100], [140, 110]);
    expect(stroke(run).box).toEqual([-1e9 + 240, 100, 60, 10]);
    expect(stroke(run).points).toHaveLength(3);
  });
});
