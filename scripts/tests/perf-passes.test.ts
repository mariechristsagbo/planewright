import { describe, expect, it } from 'vitest';

import { readControlRecord } from '../lib/perf-passes.ts';
import { CONTROL } from './trace-fixtures.ts';

// B1's passes (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): the
// budget pass, untraced, whose samples are B1's; the traced pass, whose frames the trace holds;
// and the traced pass's paired control, B1's pans once more untraced right after it.

const FILE = 'B1.control.json';

describe('readControlRecord', () => {
  it("reads the record of the traced pass's paired control", () => {
    expect(readControlRecord(CONTROL, FILE)).toEqual(CONTROL);
  });

  it("refuses a malformed record, or a traced pass's, naming the file", () => {
    const refused = [
      null,
      [],
      { ...CONTROL, id: 1 },
      { ...CONTROL, pass: 'traced' },
      { ...CONTROL, pass: undefined },
      { ...CONTROL, trace: 'B1.trace.json' },
      { ...CONTROL, warmUp: -1 },
      { ...CONTROL, warmUp: 1.5 },
      { ...CONTROL, frames: [] },
      { ...CONTROL, frames: [{ start: 1 }] },
      { ...CONTROL, frames: [{ start: 1, duration: Number.POSITIVE_INFINITY }] },
      { ...CONTROL, details: [] },
    ];
    for (const value of refused) {
      expect(() => readControlRecord(value, FILE)).toThrow(
        /^B1\.control\.json is not the record of a paired control: /u,
      );
    }
  });
});
