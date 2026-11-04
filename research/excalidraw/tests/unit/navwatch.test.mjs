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
