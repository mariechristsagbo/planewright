import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { drawText, hiddenIslands, startText, tabStops } from '../support/session.ts';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// The chrome around a text session (the v0.2 plan's S9 and responsive rule 5, issue #75's D9): while
// a phone in portrait edits a text, the dock, with More, and history and zoom carry `hidden`, out of
// the tab order and the accessibility tree yet mounted, and come back when the session ends; the
// selection panel, bar and Details sheet stay out of the page during every session (S6); desktops,
// compact layouts and phones in landscape hide nothing.

function mount(phone: boolean) {
  const turn = phoneQuery(phone);
  const harness = surfaceHarness();
  harness.editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  render(<EditorShell surface={harness.surface} />);
  const area = () => screen.getByRole('textbox', { name: 'Text' });
  const escape = (): void => {
    act(() => {
      fireEvent.keyDown(area(), { key: 'Escape' });
    });
  };
  return { ...harness, turn, area, escape };
}

const island = (name: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-island="${name}"]`);

/** The tool bar's stop and the history and zoom buttons, which a portrait session hides. */
const hideable = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(
    '[data-island="tools"] [tabindex="0"], [data-island="bottom-left"] button',
  ),
];

describe('the chrome during a text session', () => {
  it('D9 A9 hides the dock and history and zoom on a phone in portrait, out of the tab order, and shows them after', () => {
    const { editor, area, escape } = mount(true);
    const rest = tabStops();
    expect(hideable().length).toBeGreaterThan(6);
    expect(hideable().every((stop) => rest.includes(stop))).toBe(true);
    startText(editor);
    expect(area()).toHaveFocus();
    expect(hiddenIslands()).toEqual(['tools', 'bottom-left']);
    expect(island('tools')).not.toBeVisible();
    expect(island('bottom-left')).not.toBeVisible();
    expect(screen.queryByRole('toolbar', { name: 'Tools' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(hideable().filter((stop) => tabStops().includes(stop))).toEqual([]);
    // They stay mounted, so that the tool bar keeps its one stop.
    expect(island('tools')?.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    escape();
    expect(editor.view.text).toBeNull();
    expect(hiddenIslands()).toEqual([]);
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible();
    expect(tabStops()).toEqual(rest);
  });

  it('D9 A9 hides nothing on a desktop, compact or landscape window, where Undo stays unavailable', () => {
    const { editor, escape } = mount(false);
    startText(editor);
    expect(hiddenIslands()).toEqual([]);
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute('aria-disabled', 'true');
    escape();
    expect(hiddenIslands()).toEqual([]);
  });

  it('D9 A9 follows the window during a session: a turn out of portrait shows them, a turn back hides them', () => {
    const { editor, turn, area, escape } = mount(true);
    startText(editor);
    expect(hiddenIslands()).toEqual(['tools', 'bottom-left']);
    turn(false);
    expect(hiddenIslands()).toEqual([]);
    expect(area()).toHaveFocus();
    turn(true);
    expect(hiddenIslands()).toEqual(['tools', 'bottom-left']);
    expect(area()).toHaveFocus();
    escape();
    expect(hiddenIslands()).toEqual([]);
  });

  it('D9 A10 keeps the selection bar and its Details sheet out of the page during a session, and the bar back after it', () => {
    const { editor, area, escape } = mount(true);
    drawText(editor);
    act(() => {
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Details' }), {
        pointerType: 'touch',
      });
      fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    });
    expect(screen.getByRole('region', { name: 'Details' })).toBeVisible();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit text' }));
    });
    expect(area()).toHaveFocus();
    expect([island('selection'), document.getElementById('details-sheet')]).toEqual([null, null]);
    escape();
    expect(island('selection')).toHaveClass('selection-bar');
    expect(screen.getByRole('heading', { name: 'Text' })).toBeInTheDocument();
  });

  it('D9 A10 keeps the selection panel out of the page during a session on a desktop, and back after it', () => {
    const { editor, area, escape } = mount(false);
    drawText(editor);
    expect(island('selection')).toHaveClass('selection-panel');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit text' }));
    });
    expect(area()).toHaveFocus();
    expect(island('selection')).toBeNull();
    escape();
    expect(island('selection')).toHaveClass('selection-panel');
  });
});
