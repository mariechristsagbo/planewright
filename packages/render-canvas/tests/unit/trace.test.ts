import type { PathCommand } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { trace } from '../../src/trace.ts';
import { RecordingPath } from '../support/recording.ts';

// Tracing outline commands into a path (ADR 0006: shared geometry): each command becomes the path
// call that draws it, with its points in order.

describe('tracing an outline', () => {
  it('turns each command into its path call, a cubic with its first control point first', () => {
    const commands: readonly PathCommand[] = [
      { op: 'move', to: { x: 1, y: 2 } },
      { op: 'line', to: { x: 3, y: 4 } },
      { op: 'cubic', c1: { x: 5, y: 6 }, c2: { x: 7, y: 8 }, to: { x: 9, y: 10 } },
      { op: 'close' },
    ];
    const path = new RecordingPath(1);
    trace(path, commands);
    expect(path.commands).toEqual([
      ['moveTo', 1, 2],
      ['lineTo', 3, 4],
      ['bezierCurveTo', 5, 6, 7, 8, 9, 10],
      ['closePath'],
    ]);
  });
});
