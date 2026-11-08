import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasHost } from '../../src/editor/CanvasHost.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// Coalesced pointer events (docs/architecture/engine/interaction.md#input-pipeline, ADR 0008): a
// pointer move with the freehand tool gives the editor every coalesced move the browser saw, in
// order; with any other tool, or where the browser offers none, the move alone.

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 100, y: 50, width: 800, height: 600 }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const at = (x: number, y: number) => ({
  pointerId: 1,
  pointerType: 'pen',
  clientX: x,
  clientY: y,
  button: -1,
  buttons: 1,
  pressure: 0.5,
});

function mount(tool: 'tool.freehand' | 'tool.line') {
  const harness = surfaceHarness();
  render(harness.wrap(<CanvasHost />));
  harness.flush();
  const host = screen.getByRole('region', { name: 'Drawing canvas' });
  host.setPointerCapture = vi.fn();
  harness.editor.run(tool);
  fireEvent.pointerDown(host, { ...at(200, 150), button: 0 });
  const input = vi.spyOn(harness.editor, 'input');
  /** Fires a move whose coalesced events are at the given client points. */
  const moveThrough = (points: readonly (readonly [number, number])[], last: [number, number]) => {
    const event = pointerMove(last);
    Object.defineProperty(event, 'getCoalescedEvents', {
      value: () => points.map(([x, y]) => ({ ...at(x, y), timeStamp: x })),
    });
    fireEvent(host, event);
  };
  const points = () => input.mock.calls.map(([event]) => ('at' in event ? event.at : null));
  return { host, moveThrough, points };
}

/** A pointer move as jsdom can make one: a mouse event with the pointer's fields. */
function pointerMove([x, y]: readonly [number, number]) {
  const event = new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y });
  Object.assign(event, { pointerId: 1, pointerType: 'pen', pressure: 0.5 });
  Object.defineProperty(event, 'buttons', { value: 1 });
  Object.defineProperty(event, 'button', { value: -1 });
  return event;
}

describe('coalesced pointer moves', () => {
  it('D7 give a freehand stroke every coalesced move, in order', () => {
    const { moveThrough, points } = mount('tool.freehand');
    moveThrough(
      [
        [210, 150],
        [215, 152],
        [220, 155],
      ],
      [220, 155],
    );
    expect(points()).toEqual([
      { x: 110, y: 100 },
      { x: 115, y: 102 },
      { x: 120, y: 105 },
    ]);
  });

  it('give the move alone with another tool', () => {
    const line = mount('tool.line');
    line.moveThrough([[210, 150]], [230, 160]);
    expect(line.points()).toEqual([{ x: 130, y: 110 }]);
  });

  it('give the move alone when the browser offers no coalesced moves', () => {
    const { moveThrough, points, host } = mount('tool.freehand');
    moveThrough([], [240, 170]);
    fireEvent(host, pointerMove([250, 180]));
    expect(points()).toEqual([
      { x: 140, y: 120 },
      { x: 150, y: 130 },
    ]);
  });
});
