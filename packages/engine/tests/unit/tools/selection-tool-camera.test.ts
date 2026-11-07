import { describe, expect, it } from 'vitest';

import { sceneFromScreen } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import { selectionTool } from '../../../src/tools/selection-tool.ts';
import type { SelectionToolState } from '../../../src/tools/selection-tool.ts';
import type { GestureEvent, ToolEffect } from '../../../src/tools/tool.ts';
import { sceneOf } from '../../support/elements.ts';
import { ELLIPSE, RECTANGLE, selectionElements } from '../../support/selection-scene.ts';
import { toolContext } from '../../support/tool-contexts.ts';

// The Selection tool where a screen point is not the scene point (the ENG-09 review's m2): it hits
// at the screen point through the camera and draws and encloses marquees in scene units.

/** Zoom 2 with the scene point (−100, −50) at the canvas's top-left corner. */
const CAMERA: Camera = { x: -100, y: -50, zoom: 2 };
const NONE = { shift: false, alt: false, mod: false };

const at = (type: 'press' | 'drag-start' | 'drag' | 'release' | 'tap', x: number, y: number) =>
  ({
    type,
    at: { x, y },
    scene: sceneFromScreen({ x, y }, CAMERA),
    pointer: 'mouse',
    modifiers: NONE,
  }) as const;

function run(events: readonly GestureEvent[]): ToolEffect[] {
  const scene = sceneOf(...selectionElements());
  let state: SelectionToolState = selectionTool.initial;
  const effects: ToolEffect[] = [];
  for (const event of events) {
    const step = selectionTool.reduce(state, event, toolContext(scene, [], CAMERA));
    state = step.state;
    effects.push(...step.effects);
  }
  return effects;
}

describe('the Selection tool at a zoomed and panned camera', () => {
  it('REQ-S05 selects the element shown at the screen point of a press', () => {
    // The rectangle's middle (200, 150) is shown at (600, 400).
    expect(run([at('press', 600, 400), at('tap', 600, 400)])).toEqual([
      { type: 'select', ids: [RECTANGLE] },
    ]);
  });

  it('REQ-S06 draws the marquee from the press to the pointer in scene units and encloses in them', () => {
    // Scene (50, 50) is shown at (300, 200) and scene (610, 250) at (1420, 600).
    const events = [at('press', 300, 200), at('drag-start', 320, 220), at('drag', 1420, 600)];
    expect(run([...events, at('release', 1420, 600)])).toEqual([
      { type: 'marquee', box: { x: 50, y: 50, width: 10, height: 10 } },
      { type: 'marquee', box: { x: 50, y: 50, width: 560, height: 200 } },
      { type: 'marquee', box: null },
      { type: 'select', ids: [RECTANGLE, ELLIPSE] },
    ]);
  });
});
