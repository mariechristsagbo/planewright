// Runs the app-state probe and the role step of the preferences batch (s71 on) on stubbed pages
// and a stubbed localStorage. No browser is started.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('appState probe from s71 on', () => {
  const evaluating = { page: { evaluate: async (fn, arg) => fn(arg) } };

  it('keeps the arrow binding, midpoint snapping, selection mode and input device flags', async () => {
    const state = {
      theme: 'dark',
      isBindingEnabled: false,
      isMidpointSnappingEnabled: true,
      boxSelectionMode: 'overlap',
      inputDevice: 'mouse',
      openMenu: null,
    };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(state) });
    const read = await probes.appState(evaluating, {});
    expect(read.selected).toEqual({
      theme: 'dark',
      isBindingEnabled: false,
      isMidpointSnappingEnabled: true,
      boxSelectionMode: 'overlap',
      inputDevice: 'mouse',
    });
    expect(read.keys).toContain('openMenu');
  });

  it('adds none of them when the stored state has none, as in the earlier sessions', async () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ theme: 'light' }) });
    const read = await probes.appState(evaluating, {});
    expect(read.selected).toEqual({ theme: 'light' });
  });
});

// A stub locator: records clicks and attribute reads, and answers aria-expanded with `expanded`.
function menuPage(expanded) {
  const seen = [];
  const target = {
    getAttribute: async (name, options) => {
      seen.push(['getAttribute', name, options?.timeout]);
      return expanded;
    },
    click: async (options) => seen.push(['click', options?.timeout]),
  };
  const locator = { first: () => target, nth: () => target };
  const page = {
    getByRole: (role, options) => {
      seen.push(['getByRole', role, options.name, options.exact]);
      return locator;
    },
  };
  return { ctx: { page }, seen };
}

describe('role step with unlessExpanded', () => {
  const step = { role: 'menuitem', name: 'Preferences', exact: true, unlessExpanded: true };

  it('leaves an item that is already expanded alone, so its submenu stays open', async () => {
    const { ctx, seen } = menuPage('true');
    const result = await handlers.role(ctx, step);
    expect(result).toEqual({ role: 'menuitem', name: 'Preferences', skipped: 'expanded' });
    expect(seen.filter(([kind]) => kind === 'click')).toEqual([]);
    expect(seen).toContainEqual(['getAttribute', 'aria-expanded', 5000]);
  });

  it.each([['false'], [null]])('clicks an item whose aria-expanded is %s', async (expanded) => {
    const { ctx, seen } = menuPage(expanded);
    const result = await handlers.role(ctx, step);
    expect(result).toEqual({ role: 'menuitem', name: 'Preferences' });
    expect(seen.filter(([kind]) => kind === 'click')).toEqual([['click', 5000]]);
  });

  it('clicks without reading the attribute when the option is not true', async () => {
    for (const unlessExpanded of [undefined, false, 'true']) {
      const { ctx, seen } = menuPage('true');
      const result = await handlers.role(ctx, { ...step, unlessExpanded });
      expect(result).toEqual({ role: 'menuitem', name: 'Preferences' });
      expect(seen.map(([kind]) => kind)).toEqual(['getByRole', 'click']);
    }
  });
});
