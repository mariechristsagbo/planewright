// Runs the focus, connectivity and layout probes and the offline and selectOption steps (from s59
// on) on stubbed pages and stubbed globals. No browser is started.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { probes } from '../../lib/probes.mjs';

const evaluating = { page: { evaluate: async (fn, arg) => fn(arg) } };
afterEach(() => vi.unstubAllGlobals());

function element({ attrs = {}, tag = 'BUTTON', text = '', visible = true, within = [] } = {}) {
  return {
    tagName: tag,
    tabIndex: 0,
    textContent: text,
    getAttribute: (name) => attrs[name] ?? null,
    hasAttribute: (name) => name in attrs,
    matches: (selector) => selector === ':focus-visible' && visible,
    closest: (selector) => (within.some((s) => selector.includes(s)) ? {} : null),
    getBoundingClientRect: () => ({ x: 10.4, y: 20.6, width: 40, height: 40 }),
  };
}

function page({ active, live = [] }) {
  const body = { tagName: 'BODY' };
  vi.stubGlobal('document', {
    body,
    documentElement: { tagName: 'HTML' },
    activeElement: active === 'body' ? body : active,
    querySelectorAll: () => live,
  });
  vi.stubGlobal('getComputedStyle', () => ({
    outlineStyle: 'solid',
    outlineWidth: '1px',
    outlineColor: 'rgb(1, 2, 3)',
    outlineOffset: '2px',
    boxShadow: 'none',
  }));
}

describe('focus probe', () => {
  it('describes the focused element by its label, states, ring and box, and text by length', async () => {
    const attrs = { 'aria-label': 'Rectangle', 'aria-pressed': 'false', title: 'Rectangle — R' };
    page({ active: element({ attrs, text: '  R  2 ', within: ['dialog'] }) });
    const { focused } = await probes.focus(evaluating, {});
    expect(focused).toEqual({
      tag: 'BUTTON',
      type: null,
      role: null,
      name: 'Rectangle',
      textChars: 3,
      tabIndex: 0,
      states: ['aria-pressed=false'],
      disabled: false,
      focusVisible: true,
      outline: ['solid', '1px', 'rgb(1, 2, 3)', '2px'],
      boxShadow: 'none',
      rect: [10, 21, 40, 40],
      inDialog: true,
      inMenu: false,
    });
  });

  it('falls back to the title, then to no name, and never returns the text itself', async () => {
    page({ active: element({ attrs: { title: 'Library' }, text: 'some words' }) });
    expect((await probes.focus(evaluating, {})).focused.name).toBe('Library');
    page({ active: element({ text: 'some words', visible: false }) });
    const { focused } = await probes.focus(evaluating, {});
    expect(focused.name).toBeNull();
    expect(focused.focusVisible).toBe(false);
    expect(JSON.stringify(focused).includes('some words')).toBe(false);
  });

  it('reports the body as focused, and every live region with its politeness and length', async () => {
    const live = [element({ attrs: { 'aria-live': 'polite' }, text: ' Copied ' })];
    live.push(element({ attrs: { role: 'alert' } }));
    page({ active: 'body', live });
    expect(await probes.focus(evaluating, {})).toEqual({
      focused: { tag: 'BODY', body: true },
      live: [
        { role: null, live: 'polite', chars: 6, text: 'Copied' },
        { role: 'alert', live: null, chars: 0, text: '' },
      ],
    });
  });
});

describe('connectivity probe', () => {
  it('reads onLine, service worker control and the registration state with the scope path', async () => {
    const registration = {
      scope: 'https://example.com/app/',
      active: { state: 'activated' },
      waiting: null,
      installing: undefined,
    };
    vi.stubGlobal('navigator', {
      onLine: false,
      serviceWorker: { controller: {}, getRegistration: async () => registration },
    });
    vi.stubGlobal('document', { readyState: 'complete' });
    expect(await probes.connectivity(evaluating, {})).toEqual({
      onLine: false,
      controlled: true,
      registration: { scope: '/app/', active: 'activated', waiting: null, installing: null },
      readyState: 'complete',
    });
  });

  it('reports no registration and no control when the page has no service worker', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('document', { readyState: 'loading' });
    expect(await probes.connectivity(evaluating, {})).toEqual({
      onLine: true,
      controlled: false,
      registration: null,
      readyState: 'loading',
    });
  });
});

describe('layout probe', () => {
  const boxes = { Rectangle: [{ x: 1.4, y: 790.6, width: 44, height: 44 }, null], Library: [] };
  const ctx = {
    page: {
      evaluate: async () => ({ viewport: [390, 844], lang: 'en', dir: 'ltr', appClass: 'a b' }),
      getByRole: (role, { name, exact }) => ({
        all: async () =>
          role === 'button' && exact === true
            ? (boxes[name] ?? []).map((b) => ({ boundingBox: async () => b }))
            : [],
      }),
    },
  };

  it('reads the document language and the boxes of each exactly named button, in order', async () => {
    expect(await probes.layout(ctx, { buttons: ['Rectangle', 'Library'] })).toEqual({
      viewport: [390, 844],
      lang: 'en',
      dir: 'ltr',
      appClass: 'a b',
      buttons: [
        { name: 'Rectangle', boxes: [[1, 791, 44, 44], null] },
        { name: 'Library', boxes: [] },
      ],
    });
  });

  it('refuses names that are not up to 20 short strings before reading anything', async () => {
    const read = vi.fn();
    const strict = { page: { evaluate: read, getByRole: read } };
    const bad = ['Rectangle', [''], [7], Array(21).fill('A'), ['x'.repeat(61)]];
    for (const buttons of bad) {
      await expect(probes.layout(strict, { buttons })).rejects.toThrow(/^layout needs/u);
    }
    expect(read).not.toHaveBeenCalled();
  });
});
