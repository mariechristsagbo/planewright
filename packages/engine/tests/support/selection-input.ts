import type { RenderFrame } from '../../src/editor/render-frame.ts';
import type { Box } from '../../src/model/elements.ts';
import type { PointerKind } from '../../src/selection/pointer.ts';
import { down, move, up } from './inputs.ts';

// Scripted selection input for the editor tests, with a mouse or with touch (ENG-09).

export const POINTERS = ['mouse', 'touch'] as const;

/** Taps a second apart, so that no two of them make a double tap; each lasts 50 ms. */
export function tapper(pointer: PointerKind) {
  let time = 0;
  return (x: number, y: number, shift = false) => {
    time += 1_000;
    const options = { pointer, time, modifiers: { shift } };
    return [down(x, y, options), up(x, y, { ...options, time: time + 50 })];
  };
}

/** Two taps 150 ms apart at one point, which the recogniser reports as a tap and a double tap. */
export function doubleTapper(pointer: PointerKind) {
  let time = 100_000;
  return (x: number, y: number) => {
    time += 10_000;
    const options = { pointer, time };
    const later = (ms: number) => ({ ...options, time: time + ms });
    return [down(x, y, options), up(x, y, later(50)), down(x, y, later(150)), up(x, y, later(200))];
  };
}

/** A drag from one point to another through a point just past the drag threshold. */
export function drag(pointer: PointerKind, [x0, y0, x1, y1]: readonly number[], shift = false) {
  const options = { pointer, time: 10_000, modifiers: { shift } };
  const [fromX = 0, fromY = 0, toX = 0, toY = 0] = [x0, y0, x1, y1];
  return {
    start: [down(fromX, fromY, options), move(fromX + 10, fromY + 10, options)],
    to: move(toX, toY, options),
    end: up(toX, toY, options),
  };
}

export const marqueesOf = (frames: readonly RenderFrame[]): Box[] =>
  frames.flatMap((frame) =>
    (frame.overlay?.primitives ?? []).flatMap((primitive) =>
      primitive.type === 'marquee' ? [primitive.box] : [],
    ),
  );
