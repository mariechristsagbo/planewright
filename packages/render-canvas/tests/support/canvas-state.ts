import type { Call } from './recording.ts';

// A model of the Canvas 2D drawing state that the renderer uses, to replay recorded calls: what
// each drawing call drew with, whatever calls set it, so that a test can compare the state of
// every draw with the state that its element prescribes (issue #34).

export type Matrix = readonly [number, number, number, number, number, number];

/** The drawing state, as a fresh 2D context starts with it. */
export interface CanvasState {
  readonly transform: Matrix;
  readonly globalAlpha: unknown;
  readonly fillStyle: unknown;
  readonly strokeStyle: unknown;
  readonly lineWidth: unknown;
  readonly lineCap: unknown;
  readonly lineJoin: unknown;
  readonly lineDash: readonly unknown[];
  readonly font: unknown;
  readonly textAlign: unknown;
  readonly textBaseline: unknown;
}

export const DEFAULT_STATE: CanvasState = {
  transform: [1, 0, 0, 1, 0, 0],
  globalAlpha: 1,
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  lineDash: [],
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
};

/** `matrix` followed by a translation, as a context's `translate` applies it. */
export function translated([a, b, c, d, e, f]: Matrix, x: number, y: number): Matrix {
  return [a, b, c, d, e + a * x + c * y, f + b * x + d * y];
}

/** `matrix` followed by a turn, as a context's `rotate` applies it. */
export function rotated([a, b, c, d, e, f]: Matrix, angle: number): Matrix {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin, e, f];
}

/** What a drawing call depends on, by its name (the HTML standard's drawing model). */
const DEPENDS: Readonly<Record<string, readonly (keyof CanvasState)[]>> = {
  clearRect: ['transform'],
  fillRect: ['transform', 'globalAlpha', 'fillStyle'],
  fill: ['transform', 'globalAlpha', 'fillStyle'],
  stroke: [
    'transform',
    'globalAlpha',
    'strokeStyle',
    'lineWidth',
    'lineCap',
    'lineJoin',
    'lineDash',
  ],
  fillText: ['transform', 'globalAlpha', 'fillStyle', 'font', 'textAlign', 'textBaseline'],
};

/** A drawing call with the part of the state that it drew with. */
export interface Draw {
  readonly call: Call;
  readonly state: Readonly<Partial<Record<keyof CanvasState, unknown>>>;
}

/** The part of `state` that a drawing call depends on. */
export function stateFor(name: string, state: CanvasState): Draw['state'] {
  const keys = DEPENDS[name] ?? [];
  return Object.fromEntries(keys.map((key) => [key, state[key]]));
}

function step(state: CanvasState, [name, ...args]: Call): CanvasState {
  if (name.endsWith('=')) return { ...state, [name.slice(0, -1)]: args[0] };
  const numbers = args as number[];
  switch (name) {
    case 'setTransform':
      return { ...state, transform: numbers.slice(0, 6) as unknown as Matrix };
    case 'translate':
      return { ...state, transform: translated(state.transform, numbers[0] ?? 0, numbers[1] ?? 0) };
    case 'rotate':
      return { ...state, transform: rotated(state.transform, numbers[0] ?? 0) };
    case 'setLineDash':
      return { ...state, lineDash: [...(args[0] as readonly unknown[])] };
    default:
      return state;
  }
}

/**
 * Replays recorded calls from a fresh context's state, with `save` and `restore` keeping a stack
 * of states, and gives every drawing call with the state that it drew with.
 */
export function replay(calls: readonly Call[], start: CanvasState = DEFAULT_STATE): Draw[] {
  const draws: Draw[] = [];
  const saved: CanvasState[] = [];
  let state = start;
  for (const call of calls) {
    const [name] = call;
    if (name === 'save') saved.push(state);
    else if (name === 'restore') state = saved.pop() ?? state;
    else if (name in DEPENDS) draws.push({ call, state: stateFor(name, state) });
    else state = step(state, call);
  }
  return draws;
}
