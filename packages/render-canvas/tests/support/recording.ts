import type { TextMeasurer } from '@planewright/engine';

import type { CanvasSurface, Context2D } from '../../src/canvas.ts';

// Recording fakes of Canvas 2D (ADR 0006, consequences): renderer tests run in Node.js and compare
// the calls a renderer makes with the sequences that a fixture scene should produce.

/** One recorded call, `[method, ...arguments]`, or a property set, `['property=', value]`. */
export type Call = readonly [string, ...unknown[]];

/** A path that records how it was traced; a context's call names it `path <id>`. */
export class RecordingPath {
  readonly commands: Call[] = [];
  readonly id: number;
  constructor(id: number) {
    this.id = id;
  }
  moveTo(x: number, y: number): void {
    this.commands.push(['moveTo', x, y]);
  }
  lineTo(x: number, y: number): void {
    this.commands.push(['lineTo', x, y]);
  }
  bezierCurveTo(...args: [number, number, number, number, number, number]): void {
    this.commands.push(['bezierCurveTo', ...args]);
  }
  arc(...args: [number, number, number, number, number]): void {
    this.commands.push(['arc', ...args]);
  }
  closePath(): void {
    this.commands.push(['closePath']);
  }
}

/** A path factory that keeps every path it made, numbered from 1, as a renderer's `createPath`. */
export function pathFactory() {
  const made: RecordingPath[] = [];
  return {
    made,
    createPath: (): Path2D => {
      const path = new RecordingPath(made.length + 1);
      made.push(path);
      return path as unknown as Path2D;
    },
  };
}

const METHODS = [
  'save',
  'restore',
  'setTransform',
  'translate',
  'rotate',
  'clearRect',
  'fillRect',
  'strokeRect',
  'beginPath',
  'moveTo',
  'lineTo',
  'closePath',
  'arc',
  'fill',
  'stroke',
  'fillText',
  'setLineDash',
] as const;

const PROPERTIES = [
  'globalAlpha',
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'lineCap',
  'lineJoin',
  'font',
  'textAlign',
  'textBaseline',
] as const;

const named = (value: unknown): unknown =>
  value instanceof RecordingPath ? `path ${String(value.id)}` : value;

/** A 2D context that records every call and property set, in order. */
export function recordingContext(): { readonly context: Context2D; readonly calls: Call[] } {
  const calls: Call[] = [];
  const values = new Map<string, unknown>();
  const context: Record<string, unknown> = {};
  for (const name of METHODS) {
    context[name] = (...args: unknown[]) => {
      calls.push([name, ...args.map(named)]);
    };
  }
  for (const name of PROPERTIES) {
    Object.defineProperty(context, name, {
      get: () => values.get(name),
      set: (value: unknown) => {
        values.set(name, value);
        calls.push([`${name}=`, value]);
      },
    });
  }
  return { context: context as unknown as Context2D, calls };
}

/** A canvas over a recording context that also records each backing-store assignment. */
export function recordingCanvas(context: Context2D | null) {
  const sizes: Call[] = [];
  let width = 300;
  let height = 150;
  const canvas: CanvasSurface = {
    get width() {
      return width;
    },
    set width(value) {
      sizes.push(['width=', value]);
      width = value;
    },
    get height() {
      return height;
    },
    set height(value) {
      sizes.push(['height=', value]);
      height = value;
    },
    getContext: () => context,
  };
  return { canvas, sizes };
}

/** Every UTF-16 code unit is 10 units wide at size 20, and in proportion at other sizes. */
export function fixedAdvanceMeasurer(): TextMeasurer & { readonly measured: string[] } {
  const measured: string[] = [];
  return {
    measured,
    measure: (text, font) => {
      measured.push(text);
      return {
        width: (text.length * 10 * font.size) / 20,
        ascent: 0.8 * font.size,
        descent: 0.2 * font.size,
      };
    },
  };
}
