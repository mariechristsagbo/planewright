// Runs the touchHold step against a stub CDP session that records the touch events it is sent and
// when. No browser is started.
import { describe, expect, it } from 'vitest';

import { handlers } from '../../lib/steps.mjs';

function recorder() {
  const sent = [];
  const cdp = { send: async (method, params) => sent.push({ method, at: Date.now(), ...params }) };
  return { sent, ctx: { cdp } };
}

describe('touchHold', () => {
  it('presses one finger at the point, holds it still for the time given, then lifts it', async () => {
    const { sent, ctx } = recorder();
    expect(await handlers.touchHold(ctx, { at: [120, 340], ms: 150 })).toEqual({
      at: { x: 120, y: 340 },
      ms: 150,
    });
    expect(sent.map((e) => [e.method, e.type])).toEqual([
      ['Input.dispatchTouchEvent', 'touchStart'],
      ['Input.dispatchTouchEvent', 'touchEnd'],
    ]);
    expect(sent[0].touchPoints).toEqual([{ x: 120, y: 340, id: 0 }]);
    expect(sent[1].touchPoints).toEqual([]);
    expect(sent[1].at - sent[0].at).toBeGreaterThanOrEqual(140);
  });

  it('holds for 800 ms by default', async () => {
    const { sent, ctx } = recorder();
    expect(await handlers.touchHold(ctx, { at: [1, 2] })).toMatchObject({ ms: 800 });
    expect(sent[1].at - sent[0].at).toBeGreaterThanOrEqual(790);
  });

  it.each([
    ['a missing point', { ms: 200 }],
    ['a malformed point', { at: [1], ms: 200 }],
    ['a hold below 100 ms', { at: [1, 2], ms: 99 }],
    ['a hold above 5000 ms', { at: [1, 2], ms: 5001 }],
    ['a fractional hold', { at: [1, 2], ms: 250.5 }],
    ['a hold that is not a number', { at: [1, 2], ms: '800' }],
  ])('refuses %s before touching', async (_label, step) => {
    const { sent, ctx } = recorder();
    await expect(handlers.touchHold(ctx, step)).rejects.toThrow(/point|touchHold/u);
    expect(sent).toEqual([]);
  });

  it('names the allowed hold range in its refusal', async () => {
    const { ctx } = recorder();
    await expect(handlers.touchHold(ctx, { at: [1, 2], ms: 50 })).rejects.toThrow(
      /^touchHold needs an integer ms from 100 to 5000\.$/u,
    );
  });
});
