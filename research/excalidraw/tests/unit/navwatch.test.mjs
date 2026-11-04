// Exercises the navigation watcher with a stub page that emits Playwright-style events.
import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { watchNavigation } from '../../lib/navwatch.mjs';
import { memoryState } from '../../lib/session-state.mjs';

function stubPage() {
  const page = new EventEmitter();
  const main = { url: () => 'about:blank' };
  page.mainFrame = () => main;
  const navigate = (url, frame = main) => page.emit('framenavigated', { ...frame, url: () => url });
  const asMain = (url) => {
    main.url = () => url;
    page.emit('framenavigated', main);
  };
  return { page, navigate, asMain };
}

describe('watchNavigation', () => {
  it('stays clear on allowed main-frame navigations and on any subframe', () => {
    const { page, navigate, asMain } = stubPage();
    const halted = watchNavigation(page);
    asMain('https://excalidraw.com/#x');
    asMain('about:blank');
    navigate('https://elsewhere.example/');
    expect(halted()).toBeNull();
  });

  it('halts when the main frame leaves the allowlist and records metadata only', () => {
    const { page, asMain } = stubPage();
    const record = vi.fn();
    const halted = watchNavigation(page, record);
    asMain('https://elsewhere.example/p?token=SECRET#frag');
    expect(halted()).toBe('the page navigated off the allowlist.');
    expect(JSON.stringify(record.mock.calls)).not.toMatch(/SECRET|frag/u);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'navigation-halt', origin: 'https://elsewhere.example' }),
    );
  });

  it.each(['blob:https://excalidraw.com/0f8fad5b', 'chrome-error://chromewebdata/'])(
    'halts on %s',
    (url) => {
      const { page, asMain } = stubPage();
      const halted = watchNavigation(page);
      asMain(url);
      expect(halted()).not.toBeNull();
    },
  );

  it('halts at once when attached to a page already off the allowlist', () => {
    const { page, asMain } = stubPage();
    asMain('https://elsewhere.example/landing');
    const record = vi.fn();
    const halted = watchNavigation(page, record);
    expect(halted()).toBe('the page was off the allowlist when attached.');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'navigation-halt', origin: 'https://elsewhere.example' }),
    );
  });

  it('keeps the halt in the session state, so a restarted watcher stays halted', () => {
    const state = memoryState();
    const first = stubPage();
    watchNavigation(first.page, undefined, state);
    first.page.emit('popup', { url: () => 'about:blank', close: async () => undefined });
    const restarted = stubPage();
    const halted = watchNavigation(restarted.page, undefined, state);
    expect(halted()).toBe('the page opened a popup.');
  });

  it('halts on any popup, closes it, and keeps the first reason', async () => {
    const { page, asMain } = stubPage();
    const halted = watchNavigation(page);
    const popup = { url: () => 'https://excalidraw.com/', close: vi.fn(async () => undefined) };
    page.emit('popup', popup);
    asMain('https://elsewhere.example/');
    expect(halted()).toBe('the page opened a popup.');
    expect(popup.close).toHaveBeenCalledOnce();
  });
});

describe('watchNavigation in a room view', () => {
  // Synthetic, low-entropy room value built at run time (see sanitise.test.mjs).
  const ROOM_URL = `https://excalidraw.com/#room=${'a1B2'.repeat(5)},${'k_L-'.repeat(5)}m1`;

  it('halts when attached to a room view while no runLast scenario has started', () => {
    const { page, asMain } = stubPage();
    asMain(ROOM_URL);
    const record = vi.fn();
    const halted = watchNavigation(page, record);
    expect(halted()).toMatch(/collaboration value when attached/u);
    expect(JSON.stringify(record.mock.calls)).not.toMatch(/a1B2|k_L-/u);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ hasFragment: true }));
  });

  it('halts when the page enters a room view while no runLast scenario has started', () => {
    const { page, asMain } = stubPage();
    const halted = watchNavigation(page);
    asMain('https://excalidraw.com/');
    expect(halted()).toBeNull();
    asMain(ROOM_URL);
    expect(halted()).toMatch(/collaboration value without a runLast scenario/u);
  });

  it('allows a room view once a runLast scenario has started, at attach and later', () => {
    const state = memoryState();
    state.startRunLast('08-collaboration-desktop');
    const attached = stubPage();
    attached.asMain(ROOM_URL);
    expect(watchNavigation(attached.page, undefined, state)()).toBeNull();
    const later = stubPage();
    const halted = watchNavigation(later.page, undefined, state);
    later.asMain(ROOM_URL);
    expect(halted()).toBeNull();
  });
});
