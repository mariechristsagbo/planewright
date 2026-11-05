// Runs the scene probe on a stubbed page whose evaluate calls the probe function in this process
// with a stubbed localStorage. No browser is started.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { probes } from '../../lib/probes.mjs';

const ctx = { page: { evaluate: async (fn, arg) => fn(arg) } };
const stored = (elements) =>
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(elements) });
afterEach(() => vi.unstubAllGlobals());

describe('scene probe', () => {
  it('reads the elbowed flag of an arrow and leaves it out for other elements', async () => {
    stored([
      {
        type: 'arrow',
        x: 1,
        y: 2,
        points: [
          [0, 0],
          [10, 0],
        ],
        elbowed: true,
        roundness: null,
      },
      {
        type: 'arrow',
        x: 1,
        y: 9,
        points: [
          [0, 0],
          [10, 0],
        ],
        elbowed: false,
        roundness: null,
      },
      { type: 'rectangle', x: 0, y: 0, roundness: { type: 3 } },
    ]);
    const scene = await probes.scene(ctx, {});
    expect(scene.elements.map((e) => e.elbowed)).toEqual([true, false, undefined]);
    expect(scene.elements.map((e) => e.points)).toEqual([2, 2, undefined]);
    expect(JSON.parse(JSON.stringify(scene.elements[2]))).not.toHaveProperty('elbowed');
  });
});
