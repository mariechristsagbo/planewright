import type { EditorView, TextElement } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { finishKeys, hintPlace } from '../../src/editor/text/text-area.ts';
import { between, checkProperty } from '../support/property.ts';
import type { Seeded } from '../support/property.ts';

// The hint chip's rules (the v0.2 plan's S9, issue #75's D2 and D3): it names the keys that end a
// session with the platform's Mod key, and it lies 8 px under the axis-aligned bounds of the text
// area as drawn, the caret's room included and turned by the text's rotation, at their left.

type EditedText = NonNullable<EditorView['text']>;

interface Shape {
  readonly box: EditedText['box'];
  readonly size: number;
  readonly rotation: number;
}

const text = ({ box, size, rotation }: Shape): EditedText => ({
  element: {
    id: 'A'.repeat(22),
    kind: 'text',
    content: { text: 'ab', font: { family: 'hand', size, lineHeight: 1.5 }, align: 'left' },
    style: { stroke: { color: '#1e1e1e', width: 2, dash: 'solid' } },
    rotation,
  } as TextElement,
  box,
});

const BOX = { x: 10, y: 20, width: 40, height: 45 };

/**
 * The corners of the text area as drawn, written apart from the module's own sum: each corner of
 * the box widened by the caret's room, at its distance and angle from the box's centre, turned.
 */
function cornersOf({ box, size, rotation }: Shape, zoom: number): [number, number][] {
  const caret = size * zoom;
  const centre = [box.x + box.width / 2, box.y + box.height / 2] as const;
  const xs = [box.x, box.x + box.width + caret];
  const ys = [box.y, box.y + box.height];
  return xs.flatMap((x) =>
    ys.map((y): [number, number] => {
      const reach = Math.hypot(x - centre[0], y - centre[1]);
      const angle = Math.atan2(y - centre[1], x - centre[0]) + rotation;
      return [centre[0] + reach * Math.cos(angle), centre[1] + reach * Math.sin(angle)];
    }),
  );
}

const shapes = (random: Seeded) => ({
  shape: {
    box: {
      x: between(random, -500, 1500),
      y: between(random, -500, 1500),
      width: between(random, 0, 800),
      height: between(random, 1, 400),
    },
    size: between(random, 1, 200),
    rotation: between(random, -2 * Math.PI, 2 * Math.PI),
  },
  zoom: between(random, 0.1, 30),
  shift: [between(random, -2000, 2000), between(random, -2000, 2000)] as const,
});

describe('the hint chip’s place', () => {
  it('D3 lies 8 px under the text area and at its left, the caret’s room included', () => {
    expect(hintPlace(text({ box: BOX, size: 30, rotation: 0 }), 2)).toEqual({ left: 10, top: 73 });
  });

  it.each([
    ['a quarter turn', Math.PI / 2, { left: 7.5, top: 130.5 }],
    ['a half turn', Math.PI, { left: -50, top: 73 }],
  ] as const)('D3 lies under the turned text area’s bounds at %s', (_name, rotation, place) => {
    const { left, top } = hintPlace(text({ box: BOX, size: 30, rotation }), 2);
    expect(left).toBeCloseTo(place.left, 9);
    expect(top).toBeCloseTo(place.top, 9);
  });

  it('D3 takes the lowest corner’s y plus 8 and the leftmost corner’s x, at any box, size, zoom and turn', () => {
    checkProperty({ seed: 0x5e9a_7c11 }, shapes, ({ shape, zoom }) => {
      const corners = cornersOf(shape, zoom);
      const { left, top } = hintPlace(text(shape), zoom);
      expect(left).toBeCloseTo(Math.min(...corners.map(([x]) => x)), 6);
      expect(top).toBeCloseTo(Math.max(...corners.map(([, y]) => y)) + 8, 6);
    });
  });

  it('D3 depends on no camera position beyond the box: moving the box moves the chip as much', () => {
    checkProperty({ seed: 0x0b0c_5d17 }, shapes, ({ shape, zoom, shift: [dx, dy] }) => {
      const moved = { ...shape, box: { ...shape.box, x: shape.box.x + dx, y: shape.box.y + dy } };
      const before = hintPlace(text(shape), zoom);
      const after = hintPlace(text(moved), zoom);
      expect(after.left - before.left).toBeCloseTo(dx, 6);
      expect(after.top - before.top).toBeCloseTo(dy, 6);
    });
  });
});

describe('the hint chip’s words', () => {
  it('D2 names Escape and Enter with the platform’s Mod key, as people read them', () => {
    expect(finishKeys('other')).toEqual(['Esc', 'Ctrl+Enter']);
    expect(finishKeys('apple')).toEqual(['Esc', 'Cmd+Enter']);
  });
});
