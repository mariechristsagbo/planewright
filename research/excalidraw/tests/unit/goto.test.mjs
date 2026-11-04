// Exercises the goto step's navigation checks with a stub page: no browser is started and no
// website is contacted.
import { describe, expect, it, vi } from 'vitest';

import { handlers } from '../../lib/steps.mjs';

describe('goto', () => {
  const gotoCtx = (landed) => {
    const goto = vi.fn(async () => ({ status: () => 200 }));
    return { goto, ctx: { page: { goto, url: () => landed } } };
  };

  it('refuses a blob: URL before navigating', async () => {
    const { goto, ctx } = gotoCtx('about:blank');
    const step = { url: 'blob:https://excalidraw.com/0f8fad5b' };
    await expect(handlers.goto(ctx, step)).rejects.toThrow(/Navigation refused/u);
    expect(goto).not.toHaveBeenCalled();
  });

  it('refuses a room or json link value before navigating, so no room is joined', async () => {
    // Synthetic, low-entropy value built at run time (see sanitise.test.mjs).
    const value = `${'a1B2'.repeat(5)},${'k_L-'.repeat(5)}m1`;
    for (const url of [
      `https://excalidraw.com/#room=${value}`,
      `https://excalidraw.com/#json=${value}`,
    ]) {
      const { goto, ctx } = gotoCtx('about:blank');
      await expect(handlers.goto(ctx, { url })).rejects.toThrow(/Navigation refused/u);
      expect(goto).not.toHaveBeenCalled();
    }
  });

  it('stops the batch when a redirect lands off the allowlist', async () => {
    const { ctx } = gotoCtx('https://elsewhere.example/');
    const error = await handlers.goto(ctx, { url: 'https://excalidraw.com/' }).catch((e) => e);
    expect(error).toMatchObject({ fatal: true, message: expect.stringMatching(/allowlist/u) });
  });

  it('returns the status when the page stays on the reference origin', async () => {
    const { ctx } = gotoCtx('https://excalidraw.com/#x');
    expect(await handlers.goto(ctx, { url: 'https://excalidraw.com/' })).toEqual({ status: 200 });
  });
});
