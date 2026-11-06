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

describe('scene probe fields read from s51 on', () => {
  it("keeps a link's origin and path only, and leaves it out when an element has none", async () => {
    stored([
      { type: 'rectangle', link: 'https://example.com/a/b?q=secret#frag' },
      { type: 'rectangle', link: 'not a url' },
      { type: 'rectangle', link: null },
      { type: 'rectangle' },
    ]);
    const scene = await probes.scene(ctx, {});
    expect(scene.elements.map((e) => e.link)).toEqual([
      { origin: 'https://example.com', path: '/a/b' },
      { unparseable: true, chars: 9 },
      undefined,
      undefined,
    ]);
    expect(JSON.stringify(scene)).not.toMatch(/secret|frag/u);
  });

  it("reads a freehand stroke's pressure flag, pressure count and short stroke options", async () => {
    const long = { a: 'x'.repeat(200) };
    stored([
      { type: 'freedraw', simulatePressure: true, pressures: [], strokeOptions: { fixed: 1 } },
      { type: 'freedraw', simulatePressure: false, pressures: [0.5, 0.6], strokeOptions: long },
      { type: 'freedraw', strokeOptions: null },
      { type: 'rectangle' },
    ]);
    const { elements } = await probes.scene(ctx, {});
    expect(elements.map((e) => e.simulatePressure)).toEqual([true, false, undefined, undefined]);
    expect(elements.map((e) => e.pressures)).toEqual([0, 2, undefined, undefined]);
    expect(elements.map((e) => e.strokeOptions)).toEqual([
      { fixed: 1 },
      { jsonChars: JSON.stringify(long).length },
      null,
      undefined,
    ]);
    const plain = JSON.parse(JSON.stringify(elements[3]));
    for (const key of ['simulatePressure', 'pressures', 'strokeOptions', 'link']) {
      expect(plain).not.toHaveProperty(key);
    }
  });
});
