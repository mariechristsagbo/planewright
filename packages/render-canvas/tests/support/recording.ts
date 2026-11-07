import type { TextMeasurer } from '@planewright/engine';

// Recording fakes of Canvas 2D (ADR 0006, consequences): renderer tests run in Node.js and compare
// the calls a renderer makes with the sequences that a fixture scene should produce.

/** One recorded call, `[method, ...arguments]`, or a property set, `['property=', value]`. */
export type Call = readonly [string, ...unknown[]];

let nextPathId = 0;

/** A path that records how it was traced; a context's call names it `path <id>`. */
export class RecordingPath {
  readonly id = (nextPathId += 1);
  readonly commands: Call[] = [];
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

/** A path factory that keeps every path it made, as a renderer's `createPath`. */
export function pathFactory() {
  const made: RecordingPath[] = [];
  return {
    made,
    createPath: (): Path2D => {
      const path = new RecordingPath();
      made.push(path);
      return path as unknown as Path2D;
    },
  };
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
