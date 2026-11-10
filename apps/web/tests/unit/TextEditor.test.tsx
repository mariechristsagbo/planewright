import type { EditorView, PointerInput, TextElement } from '@planewright/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { endsSession, textAreaStyle } from '../../src/editor/text/text-area.ts';
import type { Platform } from '../../src/platform/platform.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The text area over the canvas (docs/architecture/engine/interaction.md#text-editing): it shows
// the edited text where the canvas would, sends each value to the editor, ends the session on
// Escape or Mod+Enter, and sits outside the canvas host, so its keys never reach the shortcuts.

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

describe('the text area', () => {
  it('REQ-C09 B-06 shows the new text at its box, focused, in its bundled font', () => {
    const { area } = placeText();
    expect(area).toHaveFocus();
    expect(area).toHaveValue('');
    expect(area.closest('.canvas-host')).toBeNull();
    expect(area).toHaveStyle({
      left: '100px',
      top: '87.5px',
      height: '25px',
      fontSize: '20px',
      fontFamily: '"Planewright Sans", sans-serif',
      lineHeight: '1.25',
    });
  });

  it('REQ-C09 sends each value to the editor, which measures it again', () => {
    const { area, editor } = placeText();
    act(() => {
      fireEvent.change(area, { target: { value: 'Hi\nthere' } });
    });
    expect(editor.view.text?.element.content.text).toBe('Hi\nthere');
    expect(area).toHaveValue('Hi\nthere');
    expect(area).toHaveStyle({ width: '70px', height: '50px' });
  });

  it('REQ-C10 pauses the shortcuts while it has focus: typed letters reach the text, not the tools', () => {
    const { area, editor } = placeText();
    act(() => {
      fireEvent.keyDown(area, { key: 'r', code: 'KeyR' });
      fireEvent.keyDown(area, { key: 'z', code: 'KeyZ', ctrlKey: true });
      fireEvent.keyDown(area, { key: 'Enter', code: 'Enter' });
    });
    expect(editor.view.tool).toBe('text');
    expect(editor.view.text).not.toBeNull();
  });

  it.each([
    ['Escape', {}],
    ['Ctrl+Enter', { key: 'Enter', ctrlKey: true }],
  ] as const)('REQ-C09 ends the session on %s', (_name, keys) => {
    const { area, editor } = placeText();
    act(() => {
      fireEvent.change(area, { target: { value: 'Hi' } });
      fireEvent.keyDown(area, { key: 'Escape', ...keys });
    });
    expect(editor.view).toMatchObject({ text: null, tool: 'selection', canUndo: true });
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
  });

  it.each([
    ['Escape', { key: 'Escape' }],
    ['Ctrl+Enter', { key: 'Enter', ctrlKey: true }],
  ] as const)(
    'gives the focus back to the canvas after %s, so Delete then removes the text',
    (_name, keys) => {
      const { area, editor } = placeText();
      act(() => {
        fireEvent.change(area, { target: { value: 'Hi' } });
        fireEvent.keyDown(area, keys);
      });
      const host = screen.getByRole('region', { name: 'Drawing canvas' });
      expect(host).toHaveFocus();
      expect(editor.view.selection).toHaveLength(1);
      act(() => {
        fireEvent.keyDown(host, { key: 'Delete', code: 'Delete' });
      });
      expect(editor.view.selection).toEqual([]);
    },
  );

  it.each([
    ['Escape', { key: 'Escape', isComposing: true }],
    ['Ctrl+Enter', { key: 'Enter', ctrlKey: true, isComposing: true }],
    ['Escape with key code 229 (Safari)', { key: 'Escape', keyCode: 229 }],
  ] as const)('keeps the session open on %s during an input method composition', (_name, keys) => {
    const { area, editor } = placeText();
    act(() => {
      fireEvent.change(area, { target: { value: 'か' } });
      fireEvent.keyDown(area, keys);
    });
    expect(editor.view.text?.element.content.text).toBe('か');
    expect(area).toHaveFocus();
  });

  it('C3 REQ-Y02 ends the session when the focus moves to another control, and keeps it when the page loses the focus', () => {
    const { area, editor } = placeText();
    act(() => {
      fireEvent.change(area, { target: { value: 'Hi' } });
      fireEvent.blur(area, { relatedTarget: null });
    });
    expect(editor.view.text?.element.content.text).toBe('Hi');
    // The list is in the Elements drawer, closed at first (ADR 0012, decision 16).
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Elements/u }));
    });
    expect(editor.view.text?.element.content.text).toBe('Hi');
    const list = screen.getByRole('listbox', { name: 'Elements' });
    act(() => {
      list.focus();
    });
    expect([editor.view.text, editor.view.elements.map(({ kind }) => kind)]).toEqual([
      null,
      ['text'],
    ]);
    expect(list).toHaveFocus();
  });

  it('ends the session on Cmd+Enter, not Ctrl+Enter, on Apple platforms', () => {
    const { area, editor } = placeText('apple');
    act(() => {
      fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true });
    });
    expect(editor.view.text).not.toBeNull();
    act(() => {
      fireEvent.keyDown(area, { key: 'Enter', metaKey: true });
    });
    expect(editor.view.text).toBeNull();
  });

  it('follows the zoom', () => {
    const { area, editor } = placeText();
    act(() => {
      editor.run('view.zoom-in');
    });
    const { camera } = editor.view;
    expect(area).toHaveStyle({ fontSize: `${String(20 * camera.zoom)}px` });
    expect(Number.parseFloat(area.style.left)).toBeCloseTo((100 - camera.x) * camera.zoom, 9);
    expect(camera.zoom).toBeGreaterThan(1);
  });
});

describe('the text area’s rules', () => {
  const text = (element: Partial<TextElement>): NonNullable<EditorView['text']> => ({
    element: {
      id: 'A'.repeat(22),
      kind: 'text',
      content: { text: 'ab', font: { family: 'hand', size: 30, lineHeight: 1.5 }, align: 'left' },
      style: { stroke: { color: '#c92a2a', width: 2, dash: 'solid' } },
      rotation: 0,
      ...element,
    } as TextElement,
    box: { x: 10, y: 20, width: 40, height: 45 },
  });

  it('turn a rotated text about the centre of its own box, scale its font and leave room for the caret after it', () => {
    expect(textAreaStyle(text({ rotation: Math.PI / 2 }), 2)).toEqual({
      left: 10,
      top: 20,
      width: 100,
      height: 45,
      paddingRight: 60,
      fontFamily: '"Planewright Hand", cursive',
      fontSize: 60,
      lineHeight: 1.5,
      textAlign: 'left',
      color: '#c92a2a',
      transform: `rotate(${String(Math.PI / 2)}rad)`,
      transformOrigin: '20px 22.5px',
    });
    expect(textAreaStyle(text({}), 1)).toMatchObject({ transform: undefined, paddingRight: 30 });
  });

  it('end a session on Escape and on Mod+Enter only', () => {
    const key = (
      key: string,
      mods: { ctrlKey?: boolean; metaKey?: boolean; isComposing?: boolean; keyCode?: number } = {},
    ) => ({
      key,
      ctrlKey: mods.ctrlKey ?? false,
      metaKey: mods.metaKey ?? false,
      isComposing: mods.isComposing ?? false,
      keyCode: mods.keyCode ?? (key === 'Escape' ? 27 : 13),
    });
    expect(endsSession(key('Escape'), 'other')).toBe(true);
    expect(endsSession(key('Enter', { ctrlKey: true }), 'other')).toBe(true);
    expect(endsSession(key('Enter', { metaKey: true }), 'other')).toBe(false);
    expect(endsSession(key('Enter', { metaKey: true }), 'apple')).toBe(true);
    expect(endsSession(key('Enter'), 'apple')).toBe(false);
    expect(endsSession(key('a', { ctrlKey: true }), 'other')).toBe(false);
  });

  it('never end a session while an input method composes', () => {
    const composing = { key: 'Escape', ctrlKey: false, metaKey: false, isComposing: true };
    expect(endsSession({ ...composing, keyCode: 27 }, 'other')).toBe(false);
    expect(endsSession({ ...composing, key: 'Enter', ctrlKey: true, keyCode: 13 }, 'other')).toBe(
      false,
    );
    expect(endsSession({ ...composing, isComposing: false, keyCode: 229 }, 'other')).toBe(false);
    expect(endsSession({ ...composing, isComposing: false, keyCode: 27 }, 'other')).toBe(true);
  });
});
