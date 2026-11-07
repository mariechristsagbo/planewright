import { describe, expect, it } from 'vitest';

import { activeTool } from '../../../src/tools/active.ts';
import { handTool } from '../../../src/tools/hand.ts';
import type { GestureEvent, ToolEffect } from '../../../src/tools/tool.ts';

// The Hand tool (docs/architecture/engine/interaction.md#p0-tools): idle and panning; a drag pans
// the camera by the pointer delta (REQ-V06).

const NONE = { shift: false, alt: false, mod: false };
const CONTEXT = { camera: { x: 0, y: 0, zoom: 1 } };

function pointer(type: 'press' | 'drag-start' | 'drag' | 'release', x: number, y: number) {
  return { type, at: { x, y }, scene: { x, y }, pointer: 'mouse', modifiers: NONE } as const;
}

/** Runs the events through the Hand tool from its initial state and returns every effect. */
function effectsOf(events: readonly GestureEvent[]): ToolEffect[] {
  let state = handTool.initial;
  const effects: ToolEffect[] = [];
  for (const event of events) {
    const step = handTool.reduce(state, event, CONTEXT);
    state = step.state;
    effects.push(...step.effects);
  }
  return effects;
}

describe('the Hand tool', () => {
  it('REQ-V06 pans by exactly the pointer delta from the press, move by move', () => {
    expect(
      effectsOf([
        pointer('press', 10, 10),
        pointer('drag-start', 14, 10),
        pointer('drag', 60, 60),
        pointer('release', 60, 60),
      ]),
    ).toEqual([
      { type: 'cursor', cursor: 'grabbing' },
      { type: 'pan', delta: { x: 4, y: 0 } },
      { type: 'pan', delta: { x: 46, y: 50 } },
      { type: 'cursor', cursor: 'grab' },
    ]);
  });

  it.each([
    { type: 'tap', at: { x: 1, y: 1 }, scene: { x: 1, y: 1 }, pointer: 'mouse', modifiers: NONE },
    { type: 'cancel' },
  ] as const)('ends the pan on $type and shows the open hand again', (end) => {
    expect(effectsOf([pointer('press', 0, 0), end, pointer('drag', 9, 9)])).toEqual([
      { type: 'cursor', cursor: 'grabbing' },
      { type: 'cursor', cursor: 'grab' },
    ]);
  });

  it('does nothing with a drag that it never saw pressed', () => {
    expect(effectsOf([pointer('drag', 9, 9), pointer('release', 9, 9)])).toEqual([]);
  });

  it('shows an open hand while idle', () => {
    expect([handTool.id, handTool.cursor, handTool.initial]).toEqual([
      'hand',
      'grab',
      { type: 'idle' },
    ]);
  });
});

describe('the active tool', () => {
  it('keeps the Hand tool’s state from one gesture to the next', () => {
    const hand = activeTool('hand');
    expect(hand.reduce(pointer('press', 0, 0), CONTEXT)).toEqual([
      { type: 'cursor', cursor: 'grabbing' },
    ]);
    expect(hand.reduce(pointer('drag', 5, 7), CONTEXT)).toEqual([
      { type: 'pan', delta: { x: 5, y: 7 } },
    ]);
    expect([hand.id, hand.cursor]).toEqual(['hand', 'grab']);
  });

  it('gives the Selection tool no behaviour until its issue: every gesture has no effect', () => {
    const selection = activeTool('selection');
    for (const type of ['press', 'drag-start', 'drag', 'release'] as const) {
      expect(selection.reduce(pointer(type, 3, 4), CONTEXT)).toEqual([]);
    }
    expect([selection.id, selection.cursor]).toEqual(['selection', 'default']);
  });
});
