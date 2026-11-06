// Runs the offline and selectOption steps (from s59 on) against stubbed pages that record what
// they are asked to do. No browser is started.
import { describe, expect, it, vi } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

// The CDP network conditions that Playwright's setOffline sends, for one offline value.
const conditions = (offline) => [
  'Network.emulateNetworkConditions',
  { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
];

// A page whose navigator.onLine follows the emulated state, or stays at `stuck` when given. Like
// Playwright's, the context skips a value it already holds. `reload` drops the page's own online
// override but not the context's value, as the offline reloads of s60 and s63 did.
function network({ stuck, workers = [] } = {}) {
  const calls = [];
  const sent = [];
  let held = false;
  let onLine = true;
  const context = {
    setOffline: async (value) => {
      calls.push(value);
      if (value === held) return;
      held = value;
      onLine = !value;
    },
    serviceWorkers: () => workers.map((url) => ({ url: () => url })),
  };
  const cdp = {
    send: async (method, params) => {
      sent.push([method, params]);
      if (method === 'Network.emulateNetworkConditions') onLine = !params.offline;
    },
  };
  const evaluate = async () => stuck ?? onLine;
  const reload = () => {
    onLine = true;
  };
  return { calls, sent, reload, ctx: { page: { context: () => context, evaluate }, cdp } };
}

describe('offline step', () => {
  it('sets the context offline and back, and reads navigator.onLine back each time', async () => {
    const workers = ['https://example.com/sw.js?v=secret#x', 'blob:https://example.com/a'];
    const { calls, ctx } = network({ workers });
    const named = ['https://example.com/sw.js', 'blob:'];
    expect(await handlers.offline(ctx, { value: true })).toEqual({
      offline: true,
      onLine: false,
      serviceWorkers: named,
    });
    expect(await handlers.offline(ctx, { value: false })).toEqual({
      offline: false,
      onLine: true,
      serviceWorkers: named,
    });
    expect(calls).toEqual([true, false]);
  });

  it("sends the same conditions to the page on the driver's own session too", async () => {
    const { sent, ctx } = network();
    await handlers.offline(ctx, { value: true });
    await handlers.offline(ctx, { value: false });
    expect(sent).toEqual([conditions(true), conditions(false)]);
  });

  it('applies a value the context already holds again, after a reload dropped it', async () => {
    const { calls, sent, reload, ctx } = network();
    await handlers.offline(ctx, { value: true });
    reload();
    expect(await ctx.page.evaluate()).toBe(true);
    expect(await handlers.offline(ctx, { value: true })).toEqual({
      offline: true,
      onLine: false,
      serviceWorkers: [],
    });
    expect(calls).toEqual([true, true]);
    expect(sent).toEqual([conditions(true), conditions(true)]);
  });

  it('stops the batch when the page does not read the emulated state back', async () => {
    const { ctx } = network({ stuck: true });
    const failure = await handlers.offline(ctx, { value: true }).catch((error) => error);
    expect(failure.fatal).toBe(true);
    expect(failure.message).toBe(
      'Offline emulation not read back, run aborted: navigator.onLine is true.',
    );
  });

  it('refuses a value that is not a boolean, fatally and before any emulation', async () => {
    for (const value of [undefined, 'true', 1, null]) {
      const { calls, sent, ctx } = network();
      const failure = await handlers.offline(ctx, { value }).catch((error) => error);
      expect(failure.fatal).toBe(true);
      expect(failure.message).toBe('offline needs a boolean value.');
      expect(calls).toEqual([]);
      expect(sent).toEqual([]);
    }
  });
});

describe('selectOption step', () => {
  const picker = () => {
    const seen = [];
    const getByRole = (role, options) => ({
      first: () => ({
        selectOption: async (option, settings) => {
          seen.push({ role, options, option, settings });
          return ['fr-FR'];
        },
      }),
    });
    return { seen, ctx: { page: { getByRole } } };
  };

  it('picks an option by its label in the named combobox and returns the selected values', async () => {
    const { seen, ctx } = picker();
    const step = { name: 'Select language', exact: true, label: 'Français' };
    expect(await handlers.selectOption(ctx, step)).toEqual({
      role: 'combobox',
      name: 'Select language',
      label: 'Français',
      values: ['fr-FR'],
    });
    expect(seen).toEqual([
      {
        role: 'combobox',
        options: { name: 'Select language', exact: true },
        option: { label: 'Français' },
        settings: { timeout: 5000 },
      },
    ]);
  });

  it('refuses a missing or empty label before looking for the element', async () => {
    const { seen, ctx } = picker();
    for (const label of [undefined, '', 3]) {
      await expect(handlers.selectOption(ctx, { name: 'x', label })).rejects.toThrow(
        /^selectOption needs an option label\.$/u,
      );
    }
    expect(seen).toEqual([]);
  });
});

describe('appState probe from s59 on', () => {
  it('keeps the canvas background colour when the stored state has one', async () => {
    const state = { viewBackgroundColor: '#ffc9c9', theme: 'light' };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(state) });
    const ctx = { page: { evaluate: async (fn, arg) => fn(arg) } };
    const read = await probes.appState(ctx, {});
    vi.unstubAllGlobals();
    expect(read.selected).toEqual({ theme: 'light', viewBackgroundColor: '#ffc9c9' });
  });
});
