import { describe, expect, it } from 'vitest';

import { INITIAL_DEFAULT_STYLE } from '../../../src/model/defaults.ts';
import type { Color } from '../../../src/model/color.ts';
import type { Style } from '../../../src/model/style.ts';
import { drawingTool } from '../../../src/tools/drawing-tool.ts';
import { SOLID, shapeElement, testId } from '../../support/elements.ts';
import { toolRun } from '../../support/tool-runs.ts';

// What the rectangle, ellipse, diamond and line tools ask of the editor (ENG-11): one transaction
// per creation, the selection and tool after it, the default style and the order key.

const NEW = testId(101);
const OLD = testId(1);

describe('REQ-C05 REQ-C13 the effects of a creation', () => {
  it('a drag clears the selection, previews, then commits one step that selects the new element alone and returns to the Selection tool', () => {
    const run = toolRun(drawingTool('rectangle'), { selected: [OLD] });
    run.drag([300, 180], [310, 190], [420, 280]);
    const types = run.run.effects.map(({ type }) => type);
    expect(types).toEqual(['select', 'preview', 'preview', 'preview', 'commit', 'set-tool']);
    expect(run.run.effects.slice(-2)).toEqual([
      { type: 'commit', label: 'create', select: [NEW] },
      { type: 'set-tool', tool: 'selection' },
    ]);
    expect(run.run.effects[0]).toEqual({ type: 'select', ids: [] });
    expect(run.run.effects[1]).toMatchObject({ changes: { elements: [{ type: 'add' }] } });
    expect(run.run.selection).toEqual([NEW]);
  });

  it('a tap does the same in one step', () => {
    const run = toolRun(drawingTool('line'), { selected: [OLD] });
    expect(run.at('tap', 400, 300).map(({ type }) => type)).toEqual([
      'select',
      'preview',
      'commit',
      'set-tool',
    ]);
  });

  it('with tool lock the commit selects nothing new and the tool stays', () => {
    const run = toolRun(drawingTool('diamond'), { toolLock: true, selected: [OLD] });
    run.drag([300, 180], [310, 190], [420, 280]);
    expect(run.run.effects.at(-1)).toEqual({ type: 'commit', label: 'create' });
    expect(run.run.selection).toEqual([]);
    expect(run.at('tap', 600, 300).at(-1)).toEqual({ type: 'commit', label: 'create' });
  });

  it('a cancel reverts a shown drawing; one before any drag has nothing to revert', () => {
    const run = toolRun(drawingTool('rectangle'));
    run.at('press', 300, 180);
    expect(run.cancel()).toEqual([]);
    run.at('press', 300, 180);
    run.at('drag-start', 320, 200);
    expect(run.cancel()).toEqual([{ type: 'cancel' }]);
    expect(run.at('release', 400, 300)).toEqual([]);
  });

  it('a press released without a drag, as a long press ends, draws nothing', () => {
    const run = toolRun(drawingTool('ellipse'));
    run.at('press', 300, 180);
    expect(run.at('release', 300, 180)).toEqual([]);
    expect(run.at('drag', 400, 300)).toEqual([]);
    expect(run.scene.get(NEW)).toBeUndefined();
  });
});

describe('REQ-C12 a new element takes the current default style', () => {
  const custom: Style = {
    stroke: { color: '#c92a2a' as Color, width: 4, dash: 'dashed' },
    fill: SOLID,
    opacity: 0.5,
    corners: 'round',
    sketch: 0,
  };

  it.each([
    ['rectangle', 'round'],
    ['diamond', 'round'],
    ['ellipse', 'sharp'],
    ['line', 'sharp'],
  ] as const)('a %s keeps the defaults with %s corners', (kind, corners) => {
    for (const defaults of [INITIAL_DEFAULT_STYLE, custom]) {
      const run = toolRun(drawingTool(kind), { defaults });
      run.at('tap', 400, 300);
      expect(run.scene.get(NEW)?.style).toEqual({ ...defaults, corners });
    }
  });

  it('is new, unrotated, unlocked and ordered above every element', () => {
    const elements = [
      shapeElement('rectangle', 10, 10, { id: 1, order: 'a' }),
      shapeElement('rectangle', 10, 10, { id: 2, order: 'b' }),
    ];
    const run = toolRun(drawingTool('rectangle'), { elements });
    run.at('tap', 400, 300);
    const element = run.scene.get(NEW);
    expect(element).toMatchObject({ kind: 'rectangle', rotation: 0, locked: false });
    expect((element?.order ?? '') > 'b').toBe(true);
  });
});

describe('the document limits', () => {
  it('nothing is drawn where the element would pass the coordinate limit', () => {
    const camera = { x: 1e9, y: 0, zoom: 1 };
    const run = toolRun(drawingTool('rectangle'), { camera });
    expect(run.at('tap', 400, 300)).toEqual([]);
    run.at('press', 400, 300);
    expect(run.at('drag-start', 420, 320)).toEqual([]);
    expect(run.at('release', 420, 320)).toEqual([]);
  });

  it('a drag past the limit keeps the last element it showed', () => {
    // A captured pointer can leave the canvas, past the camera's own limit of -1e9.
    const run = toolRun(drawingTool('rectangle'), { camera: { x: -1e9 + 100, y: 0, zoom: 1 } });
    run.at('press', 200, 100);
    run.at('drag-start', 150, 150);
    expect(run.at('drag', -500, 300)).toEqual([]);
    expect(run.at('release', -500, 300).map(({ type }) => type)).toEqual(['commit', 'set-tool']);
    expect(run.scene.get(NEW)).toMatchObject({ x: -1e9 + 250, y: 100, width: 50, height: 50 });
  });
});
