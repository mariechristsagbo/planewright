import type { PointerInput } from '@planewright/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { hintPlace } from '../../src/editor/text/text-area.ts';
import type { Platform } from '../../src/platform/platform.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// The text area's hint chip (the v0.2 plan's S9, issue #75's D1 to D3): while a text is edited
// outside a phone in portrait, a caption under the text area names the keys that end the session,
// Escape and Enter with the platform's Mod key, each in a key chip, and describes the text area;
// it follows the text area and goes when the session ends. These tests run on a desktop, where
// jsdom's matchMedia answers no query, unless a test answers the phone's. TextEditor.test.tsx keeps
// the text area's own tests, its composition tests among them, as they were.

const SENTENCE = 'Finish with Esc or Ctrl+Enter';

const tapAt = (x: number, y: number): PointerInput[] =>
  (['pointer-down', 'pointer-up'] as const).map((type, index) => ({
    type,
    pointerId: 1,
    pointer: 'mouse',
    button: 'primary',
    at: { x, y },
    modifiers: { shift: false, alt: false, mod: false },
    time: 1_000 + index * 50,
  }));

function placeText(platform: Platform = 'other') {
  const harness = surfaceHarness(platform);
  render(<EditorShell surface={harness.surface} />);
  const { editor } = harness;
  act(() => {
    editor.run('tool.text');
    for (const event of tapAt(100, 100)) editor.input(event);
  });
  return { editor, area: screen.getByRole('textbox', { name: 'Text' }) };
}

/** The chip, if it is in the page. */
const hint = (): HTMLElement | null => document.getElementById('text-editor-hint');

describe('the hint chip', () => {
  it('D2 A2 names Esc and Ctrl+Enter in key chips under the text area, which it describes', () => {
    const { area } = placeText();
    const chip = hint();
    expect(chip?.tagName).toBe('P');
    expect(chip?.textContent).toBe(SENTENCE);
    expect([...(chip?.querySelectorAll('kbd') ?? [])].map((key) => key.textContent)).toEqual([
      'Esc',
      'Ctrl+Enter',
    ]);
    expect(area).toHaveAttribute('aria-describedby', 'text-editor-hint');
    expect(area).toHaveAccessibleDescription(SENTENCE);
    expect(area).toHaveAccessibleName('Text');
    expect(area).toHaveFocus();
    // It lies over the canvas with the text area, takes no focus and says nothing by itself.
    expect(chip?.closest('.text-layer')).not.toBeNull();
    expect(chip?.closest('.canvas-host')).toBeNull();
    expect(chip).not.toHaveAttribute('tabindex');
    expect(chip).not.toHaveAttribute('role');
    expect(chip).not.toHaveAttribute('aria-live');
    expect(chip).not.toHaveAttribute('data-chrome-tip');
  });

  it('D2 A2 names Cmd+Enter on Apple platforms', () => {
    const { area } = placeText('apple');
    expect(hint()?.textContent).toBe('Finish with Esc or Cmd+Enter');
    expect(area).toHaveAccessibleDescription('Finish with Esc or Cmd+Enter');
  });

  it('D3 A3 sits where hintPlace puts it, following the typed value and the zoom', () => {
    const { area, editor } = placeText();
    const expectPlace = (): void => {
      const { text, camera } = editor.view;
      if (text === null) throw new Error('No text is edited.');
      const { left, top } = hintPlace(text, camera.zoom);
      // jsdom writes the style's lengths rounded, so they are compared as numbers.
      expect(Number.parseFloat(hint()?.style.left ?? '')).toBeCloseTo(left, 6);
      expect(Number.parseFloat(hint()?.style.top ?? '')).toBeCloseTo(top, 6);
    };
    expectPlace();
    expect(hint()).toHaveStyle({ left: '100px', top: '120.5px' });
    act(() => {
      fireEvent.change(area, { target: { value: 'Hi\nthere' } });
    });
    expectPlace();
    expect(hint()).toHaveStyle({ top: '145.5px' });
    act(() => {
      editor.run('view.zoom-in');
    });
    expect(editor.view.camera.zoom).toBeGreaterThan(1);
    expectPlace();
  });

  it.each([
    ['Escape', { key: 'Escape' }],
    ['Ctrl+Enter', { key: 'Enter', ctrlKey: true }],
  ] as const)('A4 goes when %s ends the session, with the description', (_name, keys) => {
    const { area } = placeText();
    act(() => {
      fireEvent.change(area, { target: { value: 'Hi' } });
      fireEvent.keyDown(area, keys);
    });
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
    expect(hint()).toBeNull();
  });

  it('A4 goes when the focus moves to another control, and stays when the page loses the focus', () => {
    const { area, editor } = placeText();
    act(() => {
      fireEvent.blur(area, { relatedTarget: null });
    });
    expect(hint()).not.toBeNull();
    act(() => {
      fireEvent.blur(area, { relatedTarget: screen.getByRole('button', { name: /^Elements/u }) });
    });
    expect(editor.view.text).toBeNull();
    expect(hint()).toBeNull();
  });

  it('D1 A2 shows neither the chip nor a description on a phone in portrait', () => {
    phoneQuery(true);
    const { area } = placeText();
    expect(hint()).toBeNull();
    expect(area).not.toHaveAttribute('aria-describedby');
    expect(area).toHaveAccessibleDescription('');
    expect(area).toHaveFocus();
  });
});
