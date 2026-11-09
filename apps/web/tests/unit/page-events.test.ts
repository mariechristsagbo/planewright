import { describe, expect, it, vi } from 'vitest';

import { watchPage } from '../../src/platform/page-events.ts';

// The page asks the editor to save when it is hidden or unloaded (REQ-P01), and to measure texts
// again when a font finishes loading (ADR 0011).

function page(visibility: DocumentVisibilityState) {
  const document = Object.assign(new EventTarget(), { visibilityState: visibility });
  return { window: new EventTarget(), document, fonts: new EventTarget() };
}

describe('watchPage', () => {
  it('REQ-P01 saves at once when the page is hidden or unloaded', () => {
    const editor = { saveNow: vi.fn(), measureTexts: vi.fn() };
    const hidden = page('hidden');
    watchPage(hidden, editor);
    hidden.document.dispatchEvent(new Event('visibilitychange'));
    hidden.window.dispatchEvent(new Event('pagehide'));
    expect(editor.saveNow).toHaveBeenCalledTimes(2);
    const visible = page('visible');
    watchPage(visible, editor);
    visible.document.dispatchEvent(new Event('visibilitychange'));
    expect(editor.saveNow).toHaveBeenCalledTimes(2);
  });

  it('measures texts again when a font finishes loading, until it stops listening', () => {
    const editor = { saveNow: vi.fn(), measureTexts: vi.fn() };
    const watched = page('hidden');
    const stop = watchPage(watched, editor);
    watched.fonts.dispatchEvent(new Event('loadingdone'));
    expect(editor.measureTexts).toHaveBeenCalledTimes(1);
    stop();
    watched.fonts.dispatchEvent(new Event('loadingdone'));
    watched.document.dispatchEvent(new Event('visibilitychange'));
    watched.window.dispatchEvent(new Event('pagehide'));
    expect([editor.measureTexts.mock.calls.length, editor.saveNow.mock.calls.length]).toEqual([
      1, 0,
    ]);
  });
});
