import { describe, expect, it } from 'vitest';

import type { Color } from '../../../src/model/color.ts';
import { INITIAL_DEFAULT_STYLE } from '../../../src/model/defaults.ts';
import type { Style } from '../../../src/model/style.ts';
import { textTool } from '../../../src/tools/text-tool.ts';
import { shapeElement, testId } from '../../support/elements.ts';
import { toolRun } from '../../support/tool-runs.ts';

// The Text tool (docs/architecture/engine/interaction.md#p0-tools): a tap adds an empty text whose
// left edge is at the tap and whose first line is centred on it, then asks the editor to edit it.
// B-06's click at (820,420) gave a text at x 820 and y 407.5, 25 high, in behavior-analysis.md.

const NEW = testId(101);
const OLD = testId(1);
const EMPTY = { text: '', font: { family: 'sans', size: 20, lineHeight: 1.25 }, align: 'left' };

describe('REQ-C09 the Text tool', () => {
  it('B-06 places an empty text with its left edge at a tap and its first line centred on it', () => {
    const run = toolRun(textTool, {
      selected: [OLD],
      elements: [shapeElement('ellipse', 10, 10, { id: 1 })],
    });
    run.at('press', 820, 420);
    expect(run.run.effects).toEqual([]);
    run.at('tap', 820, 420);
    expect(run.run.effects.map(({ type }) => type)).toEqual(['select', 'preview', 'edit-text']);
    expect(run.run.effects[0]).toEqual({ type: 'select', ids: [] });
    expect(run.run.effects[2]).toEqual({ type: 'edit-text', id: NEW });
    expect(run.scene.get(NEW)).toEqual({
      id: NEW,
      kind: 'text',
      order: expect.any(String) as unknown,
      x: 820,
      y: 407.5,
      width: 0,
      height: 25,
      rotation: 0,
      style: { ...INITIAL_DEFAULT_STYLE, corners: 'sharp' },
      locked: false,
      rev: 1,
      content: EMPTY,
    });
    expect(run.scene.ordered().map(({ id }) => id)).toEqual([OLD, NEW]);
  });

  it('places at the scene point under the tap, whatever the camera, and on a double tap too', () => {
    const run = toolRun(textTool, { camera: { x: 100, y: -50, zoom: 2 } });
    run.at('double-tap', 300, 200);
    expect(run.scene.get(NEW)).toMatchObject({ x: 250, y: 37.5, width: 0, height: 25 });
  });

  it('REQ-C12 takes the current default style', () => {
    const defaults: Style = {
      ...INITIAL_DEFAULT_STYLE,
      stroke: { ...INITIAL_DEFAULT_STYLE.stroke, color: '#c92a2a' as Color },
    };
    const run = toolRun(textTool, { defaults });
    run.at('tap', 0, 0);
    expect(run.scene.get(NEW)?.style).toEqual({ ...defaults, corners: 'sharp' });
  });

  it('does nothing on a press, a drag, a release or a cancel', () => {
    const run = toolRun(textTool);
    run.drag([100, 100], [140, 120], [200, 200]);
    run.cancel();
    expect(run.run.effects).toEqual([]);
    expect(textTool.cursor).toBe('text');
    expect(run.state()).toEqual({ type: 'idle' });
  });

  it('places nothing past the coordinate limit', () => {
    const run = toolRun(textTool, { camera: { x: 1e9, y: 0, zoom: 1 } });
    run.at('tap', 10, 10);
    expect(run.run.effects).toEqual([]);
    const below = toolRun(textTool, { camera: { x: 0, y: -1e9, zoom: 1 } });
    below.at('tap', 0, 5);
    expect(below.run.effects).toEqual([]);
  });
});
