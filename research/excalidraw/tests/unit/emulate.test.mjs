// Exercises the emulate step with a stub CDP session and page: the screen orientation it asks
// for, the read-back that fails fast on another one, and the refusal of an invalid one before
// any CDP call. No browser is started and no website is contacted.
import { describe, expect, it } from 'vitest';

import { handlers } from '../../lib/steps.mjs';

const PORTRAIT = { type: 'portraitPrimary', angle: 0 };
const step = (extra = {}) => ({
  do: 'emulate',
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
  hasTouch: true,
  ...extra,
});
// What about:blank reports after the mobile emulation, with the given orientation.
const blank = (orientationType, orientationAngle) => ({
  innerWidth: 980,
  innerHeight: 2120,
  devicePixelRatio: 3,
  screenWidth: 390,
  screenHeight: 844,
  orientationType,
  orientationAngle,
  maxTouchPoints: 5,
  coarsePointer: true,
  canvases: [],
});

function stubCtx(read) {
  const calls = [];
  return {
    calls,
    cdp: { send: async (method, params) => calls.push({ method, params }) },
    page: { evaluate: async () => read },
  };
}

describe('emulate and the screen orientation', () => {
  it('asks for the named orientation and passes when the page reads it back', async () => {
    const ctx = stubCtx(blank('portrait-primary', 0));
    await expect(handlers.emulate(ctx, step({ screenOrientation: PORTRAIT }))).resolves.toEqual(
      blank('portrait-primary', 0),
    );
    expect(ctx.calls[0].method).toBe('Emulation.setDeviceMetricsOverride');
    expect(ctx.calls[0].params.screenOrientation).toEqual(PORTRAIT);
  });

  it('fails fast when the page reads another orientation than the one asked for', async () => {
    const ctx = stubCtx(blank('landscape-primary', 0));
    const run = handlers.emulate(ctx, step({ screenOrientation: PORTRAIT }));
    await expect(run).rejects.toMatchObject({ fatal: true });
    await expect(run).rejects.toThrow(
      /^Metrics mismatch, run aborted: orientationType: expected portrait-primary, read landscape-primary$/u,
    );
  });

  it('leaves the orientation to the browser when the step names none', async () => {
    const ctx = stubCtx(blank('landscape-primary', 0));
    await handlers.emulate(ctx, step());
    expect('screenOrientation' in ctx.calls[0].params).toBe(false);
  });

  it.each([
    [{ type: 'portrait', angle: 0 }],
    [{ type: 'portraitPrimary', angle: 45 }],
    [{ type: 'portraitPrimary' }],
    ['portraitPrimary'],
  ])('refuses the orientation %j before any CDP call', async (screenOrientation) => {
    const ctx = stubCtx(blank('portrait-primary', 0));
    const run = handlers.emulate(ctx, step({ screenOrientation }));
    await expect(run).rejects.toMatchObject({ fatal: true });
    await expect(run).rejects.toThrow(/^screenOrientation needs a type of portraitPrimary/u);
    expect(ctx.calls).toEqual([]);
  });
});
