// Runs the touchPath step against a stub CDP session that records the touch events it is sent.
// No browser is started.
import { describe, expect, it } from 'vitest';

import { handlers } from '../../lib/steps.mjs';

function recorder() {
  const sent = [];
  const cdp = { send: async (method, params) => sent.push({ method, ...params }) };
  return { sent, ctx: { cdp } };
}
const finger = (x, y) => [{ x, y, id: 0 }];

describe('touchPath', () => {
  it('moves one finger through every point in order, with the given moves per segment', async () => {
    const { sent, ctx } = recorder();
    const points = [
      [0, 0],
      [10, 0],
      [10, 20],
    ];
    expect(await handlers.touchPath(ctx, { points, steps: 2 })).toEqual({ points: 3 });
    expect(new Set(sent.map((e) => e.method))).toEqual(new Set(['Input.dispatchTouchEvent']));
    expect(sent.map((e) => e.type)).toEqual([
      'touchStart',
      ...Array(4).fill('touchMove'),
      'touchEnd',
    ]);
    expect(sent.slice(0, 5).map((e) => e.touchPoints)).toEqual([
      finger(0, 0),
      finger(5, 0),
      finger(10, 0),
      finger(10, 10),
      finger(10, 20),
    ]);
    expect(sent.at(-1).touchPoints).toEqual([]);
  });

  it('makes 4 moves per segment by default', async () => {
    const { sent, ctx } = recorder();
    const points = [
      [0, 0],
      [8, 0],
    ];
    await handlers.touchPath(ctx, { points });
    expect(sent.filter((e) => e.type === 'touchMove').map((e) => e.touchPoints)).toEqual([
      finger(2, 0),
      finger(4, 0),
      finger(6, 0),
      finger(8, 0),
    ]);
  });

  it('refuses fewer than two points, a malformed point or a bad move count before touching', async () => {
    const two = [
      [1, 2],
      [3, 4],
    ];
    const bad = [
      { points: undefined },
      { points: [] },
      { points: [[1, 2]] },
      { points: [[1, 2], [3]] },
      { points: two, steps: 0 },
      { points: two, steps: 2.5 },
      { points: two, steps: 51 },
    ];
    for (const step of bad) {
      const { sent, ctx } = recorder();
      await expect(handlers.touchPath(ctx, step)).rejects.toThrow(/touchPath|point/u);
      expect(sent).toEqual([]);
    }
  });
});
