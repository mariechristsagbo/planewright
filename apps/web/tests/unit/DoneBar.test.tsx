import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CANVAS_ID } from '../../src/a11y/focus.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { hiddenIslands, startText, tabStops } from '../support/session.ts';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// The phone's Done bar (the v0.2 plan's S9 and responsive rule 5, issue #75's D5, D7, D8 and D12):
// on a phone in portrait, while a text is edited, a bar with one button, Done, follows the text
// area in the tab order; Done commits the text as Escape does and gives the focus to the canvas, a
// press on the bar keeps the text area's focus, a blur between the text area and Done keeps the
// session, and Done commits during a composition, whose keys keep ending nothing.

function mount(phone = true) {
  const turn = phoneQuery(phone);
  const harness = surfaceHarness();
  harness.editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  render(<EditorShell surface={harness.surface} />);
  const area = () => screen.getByRole('textbox', { name: 'Text' });
  const done = () => screen.getByRole('button', { name: 'Done' });
  return { ...harness, turn, area, done };
}

/** The Done bar, if it is in the page. */
const bar = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-island="done"]');

describe('the Done bar', () => {
  it('D5 A5 shows only during a session, one button named Done that follows the text area in the tab order', () => {
    const { editor, area, done } = mount();
    expect(bar()).toBeNull();
    startText(editor);
    expect(within(bar() ?? document.body).getAllByRole('button')).toEqual([done()]);
    expect(bar()).not.toHaveAttribute('role');
    expect(done()).toHaveTextContent(/^Done$/u);
    expect(done()).toHaveAttribute('type', 'button');
    for (const name of ['aria-keyshortcuts', 'data-chrome-tip', 'aria-describedby']) {
      expect(done()).not.toHaveAttribute(name);
    }
    expect(done().querySelector('svg')).toBeNull();
    // The bottom-right island is not shown on a phone in portrait, by the style sheet alone, which
    // jsdom does not apply; the tool bar and history and zoom carry `hidden`.
    const stops = tabStops().filter(
      (stop) => stop.closest('[data-island="bottom-right"]') === null,
    );
    expect(stops).toEqual([
      screen.getByRole('button', { name: 'Planewright menu' }),
      screen.getByRole('button', { name: 'Pre-release' }),
      document.getElementById(CANVAS_ID),
      area(),
      done(),
      screen.getByRole('button', { name: /^Elements/u }),
    ]);
    expect(hiddenIslands()).toEqual(['tools', 'bottom-left']);
  });

  it('D7 A6 commits the text as Escape does: drawn and selected, one undo step, the canvas focused and the bar gone', () => {
    const { editor, area, done } = mount();
    startText(editor);
    act(() => {
      fireEvent.change(area(), { target: { value: 'Plan' } });
    });
    act(() => {
      fireEvent.click(done());
    });
    const [text] = editor.view.elements;
    expect(editor.view).toMatchObject({ text: null, tool: 'selection', canUndo: true });
    expect(text).toMatchObject({ kind: 'text', content: { text: 'Plan' } });
    expect(editor.view.selection).toEqual([text?.id]);
    expect(document.activeElement).toBe(document.getElementById(CANVAS_ID));
    expect(bar()).toBeNull();
    expect(hiddenIslands()).toEqual([]);
    act(() => {
      editor.run('history.undo');
    });
    expect([editor.view.elements, editor.view.canUndo]).toEqual([[], false]);
  });

  it('D7 A15 keeps the text area’s focus on a press on the bar or on Done: pointerdown and mousedown are default-prevented', () => {
    const { editor, area, done } = mount();
    startText(editor);
    for (const target of [bar(), done()]) {
      if (target === null) throw new Error('No Done bar.');
      expect(fireEvent.pointerDown(target, { pointerType: 'touch' })).toBe(false);
      expect(fireEvent.mouseDown(target)).toBe(false);
    }
    expect(area()).toHaveFocus();
    expect(editor.view.text).not.toBeNull();
  });

  it('D8 A12 keeps the session when the text area blurs to Done or Done to no element, and commits when Done blurs to another control', () => {
    const { editor, area, done } = mount();
    startText(editor);
    act(() => {
      fireEvent.change(area(), { target: { value: 'Plan' } });
    });
    act(() => {
      fireEvent.blur(area(), { relatedTarget: done() });
    });
    expect(editor.view.text).not.toBeNull();
    act(() => {
      done().focus();
    });
    expect(done()).toHaveFocus();
    expect(editor.view.text).not.toBeNull();
    act(() => {
      fireEvent.blur(done(), { relatedTarget: null });
    });
    expect([editor.view.text === null, bar() === null]).toEqual([false, false]);
    act(() => {
      fireEvent.blur(done(), { relatedTarget: area() });
    });
    expect(editor.view.text).not.toBeNull();
    const elements = screen.getByRole('button', { name: /^Elements/u });
    act(() => {
      elements.focus();
    });
    expect([editor.view.text, editor.view.elements.length, bar()]).toEqual([null, 1, null]);
    expect(elements).toHaveFocus();
  });

  it.each([
    ['Escape', { key: 'Escape', isComposing: true }],
    ['Ctrl+Enter', { key: 'Enter', ctrlKey: true, isComposing: true }],
  ] as const)(
    'D12 A14 keeps the session and the bar on %s during a composition, and Done then commits the composed text',
    (_name, keys) => {
      const { editor, area, done } = mount();
      startText(editor);
      act(() => {
        fireEvent.compositionStart(area());
        fireEvent.change(area(), { target: { value: 'か' } });
        fireEvent.keyDown(area(), keys);
      });
      expect([editor.view.text?.element.content.text, bar() === null]).toEqual(['か', false]);
      expect(area()).toHaveFocus();
      // Done stays available while the input method composes, since it is no key of the method's.
      expect(done()).toBeEnabled();
      expect(done()).not.toHaveAttribute('aria-disabled');
      act(() => {
        fireEvent.click(done());
      });
      expect(editor.view.text).toBeNull();
      expect(editor.view.elements).toMatchObject([{ kind: 'text', content: { text: 'か' } }]);
    },
  );

  it('D1 A5 shows no bar on a desktop, compact or landscape window, where the chip shows', () => {
    const { editor } = mount(false);
    startText(editor);
    expect(bar()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(document.getElementById('text-editor-hint')).not.toBeNull();
  });

  it('D8 A12 gives the text area the focus when Done leaves with it as the window turns, and a turn back shows the bar again', () => {
    const { editor, turn, area, done } = mount();
    startText(editor);
    act(() => {
      done().focus();
    });
    turn(false);
    expect(bar()).toBeNull();
    expect(area()).toHaveFocus();
    expect(editor.view.text).not.toBeNull();
    expect(document.getElementById('text-editor-hint')).not.toBeNull();
    expect(hiddenIslands()).toEqual([]);
    turn(true);
    expect(bar()).not.toBeNull();
    expect(hiddenIslands()).toEqual(['tools', 'bottom-left']);
    expect(area()).toHaveFocus();
    expect(document.getElementById('text-editor-hint')).toBeNull();
  });
});
