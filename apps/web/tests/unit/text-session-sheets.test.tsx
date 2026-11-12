import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { MORE_BUTTON_ID } from '../../src/shell/more-tools.ts';
import { drawText, startText } from '../support/session.ts';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// No sheet during a phone's text session (the v0.2 plan's S9, issue #75's D10): a session that
// starts on a phone in portrait, or a window that turns to portrait during one, closes the open
// Elements sheet, which would cover the Done bar, without moving the focus, which stays in the text
// area, and the session stays open; More stays closed.

function mount(phone: boolean) {
  const turn = phoneQuery(phone);
  const harness = surfaceHarness();
  harness.editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  render(<EditorShell surface={harness.surface} />);
  /** A tap: a touch press then a click, so that the focus it moves opens no tooltip (S3). */
  const tap = (element: HTMLElement): void => {
    act(() => {
      fireEvent.pointerDown(element, { pointerType: 'touch' });
      fireEvent.click(element);
    });
  };
  const toggle = () => screen.getByRole('button', { name: /^Elements/u });
  const area = () => screen.getByRole('textbox', { name: 'Text' });
  return { ...harness, turn, tap, toggle, area };
}

/** Whether the Elements drawer or sheet is open: its toggle's state and its mounted list box. */
const elementsOpen = (toggle: HTMLElement): [string | null, boolean] => [
  toggle.getAttribute('aria-expanded'),
  document.querySelector('[role="listbox"]') !== null,
];

describe('the Elements sheet and a phone’s text session', () => {
  it('D10 A11 closes when Edit text on the selection bar starts a session, the text area keeping the focus and More closed', () => {
    const { editor, tap, toggle, area } = mount(true);
    drawText(editor);
    tap(toggle());
    expect(elementsOpen(toggle())).toEqual(['true', true]);
    expect(screen.getByRole('listbox', { name: 'Elements' })).toHaveFocus();
    tap(screen.getByRole('button', { name: 'Edit text' }));
    expect(editor.view.text).not.toBeNull();
    expect(elementsOpen(toggle())).toEqual(['false', false]);
    expect(area()).toHaveFocus();
    expect(document.getElementById(MORE_BUTTON_ID)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('D10 A11 closes when a window turns to portrait during a session, the text area keeping the focus', () => {
    const { editor, turn, tap, toggle, area } = mount(false);
    tap(toggle());
    expect(elementsOpen(toggle())).toEqual(['true', true]);
    startText(editor);
    expect(area()).toHaveFocus();
    // On a desktop the drawer is no sheet, and stays open beside the session.
    expect(elementsOpen(toggle())).toEqual(['true', true]);
    turn(true);
    expect(elementsOpen(toggle())).toEqual(['false', false]);
    expect(area()).toHaveFocus();
    expect(editor.view.text).not.toBeNull();
  });

  it('D10 A11 closes an Elements sheet opened during a portrait session at once, the text area keeping the focus and the session open', () => {
    const { editor, tap, toggle, area } = mount(true);
    startText(editor);
    act(() => {
      fireEvent.change(area(), { target: { value: 'Plan' } });
    });
    // A tap that moves no focus, as Safari on iOS gives one: the text area keeps it.
    tap(toggle());
    expect(elementsOpen(toggle())).toEqual(['false', false]);
    expect(area()).toHaveFocus();
    expect(editor.view.text?.element.content.text).toBe('Plan');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('D10 keeps the drawer’s opening elsewhere: during a desktop session the list box takes the focus, which ends the session, as before', () => {
    const { editor, tap, toggle, area } = mount(false);
    startText(editor);
    act(() => {
      fireEvent.change(area(), { target: { value: 'Plan' } });
    });
    tap(toggle());
    expect(elementsOpen(toggle())).toEqual(['true', true]);
    expect(screen.getByRole('listbox', { name: 'Elements' })).toHaveFocus();
    expect(editor.view.text).toBeNull();
  });

  it('D10 keeps the drawer’s focus moves outside a session: closing it gives the focus to Elements', () => {
    const { tap, toggle } = mount(true);
    tap(toggle());
    tap(screen.getByRole('button', { name: 'Close Elements' }));
    expect(elementsOpen(toggle())).toEqual(['false', false]);
    expect(toggle()).toHaveFocus();
  });
});
