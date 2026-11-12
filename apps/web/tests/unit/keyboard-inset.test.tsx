import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { keyboardInset } from '../../src/shell/keyboard-inset.ts';
import { startText } from '../support/session.ts';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';
import { emulateKeyboard } from '../support/visual-viewport.ts';

// The keyboard's inset (the v0.2 plan's S9 and responsive rule 5, issue #75's D6): the part of the
// layout viewport under the visual viewport's bottom, never below 0, and 0 without a visual
// viewport; the Done bar writes it into its own --kb, in px, when it mounts and at each of the
// visual viewport's resize and scroll events, and listens to them only while it is mounted.

describe('the keyboard’s inset', () => {
  it.each([
    [844, 508, 0, 336],
    [844, 400, 100, 344],
    [844, 844, 0, 0],
    [844, 900, 0, 0],
  ] as const)(
    'D6 A7 over a %i px layout, a %i px visual viewport %i px down leaves %i px',
    (layoutHeight, visualHeight, offsetTop, inset) => {
      expect(keyboardInset({ layoutHeight, visualHeight, offsetTop })).toBe(inset);
    },
  );

  it('D6 A7 is 0 without a visual viewport', () => {
    expect(keyboardInset(null)).toBe(0);
  });
});

function mount() {
  phoneQuery(true);
  const harness = surfaceHarness();
  harness.editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  render(<EditorShell surface={harness.surface} />);
  const kb = (): string =>
    document.querySelector<HTMLElement>('[data-island="done"]')?.style.getPropertyValue('--kb') ??
    'no bar';
  return { ...harness, kb };
}

describe('the Done bar’s --kb', () => {
  it('D6 A7 reads the inset when the bar mounts, then follows resize and scroll, listening only while the bar shows', () => {
    const keyboard = emulateKeyboard(844, 508);
    const { editor, kb } = mount();
    expect([kb(), keyboard.listeners()]).toEqual(['no bar', 0]);
    startText(editor);
    const camera = editor.view.camera;
    expect(kb()).toBe('336px');
    expect(keyboard.listeners()).toBe(2);
    keyboard.move({ height: 400 }, 'resize');
    expect(kb()).toBe('444px');
    keyboard.move({ offsetTop: 100 }, 'scroll');
    expect(kb()).toBe('344px');
    keyboard.move({ height: 900, offsetTop: 0 }, 'resize');
    expect(kb()).toBe('0px');
    act(() => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Text' }), { key: 'Escape' });
    });
    expect([kb(), keyboard.listeners()]).toEqual(['no bar', 0]);
    // The keyboard moves no camera (D6 and D11): the view is as the session found it.
    expect(editor.view.camera).toEqual(camera);
  });

  it('D6 A7 reads 0px where the window has no visual viewport', () => {
    expect('visualViewport' in window).toBe(false);
    const { editor, kb } = mount();
    startText(editor);
    expect(kb()).toBe('0px');
  });
});
