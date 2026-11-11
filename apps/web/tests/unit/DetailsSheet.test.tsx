import type { Editor } from '@planewright/engine';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { CANVAS_ID } from '../../src/a11y/focus.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// The phone's Details sheet (ADR 0012, decisions 13 and 14; the v0.2 plan's S6, issue #69's D4 and
// A7): Details opens it with the focus on Close Details, Close and Escape close it with the focus
// back on Details and the selection kept, it and the Elements sheet are never open together, it
// closes when the selection empties, a text session starts or the window leaves the phone's query,
// it is closed at every load and stored nowhere, and the covered islands are inert while it is open.

function mount(draw: (editor: Editor) => void = drawRectangle) {
  const change = phoneQuery(true);
  const harness = surfaceHarness();
  harness.editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  render(<EditorShell surface={harness.surface} />);
  act(() => {
    draw(harness.editor);
  });
  /** A tap: a touch press then a click, so that the focus it moves opens no tooltip (S3). */
  const click = (element: HTMLElement): void => {
    act(() => {
      fireEvent.pointerDown(element, { pointerType: 'touch' });
      fireEvent.click(element);
    });
  };
  const details = () => screen.getByRole('button', { name: 'Details' });
  return { ...harness, change, click, details };
}

function drawRectangle(editor: Editor): void {
  editor.run('tool.rectangle');
  editor.run('canvas.enter');
}

function drawText(editor: Editor): void {
  editor.run('tool.text');
  editor.run('canvas.enter');
  editor.editText({ type: 'value', text: 'Plan' });
  editor.editText({ type: 'commit' });
}

/** The Details sheet's element, open or not. */
const sheet = (): HTMLElement | null => document.getElementById('details-sheet');

/** The islands whose controls are inert, by name. */
const inert = (): (string | undefined)[] =>
  [...document.querySelectorAll('[inert]')].map(
    (element) => element.closest<HTMLElement>('[data-island]')?.dataset['island'],
  );

describe('the Details sheet', () => {
  it('D4 A7 opens from Details with the focus on Close Details, and Close and Escape close it with the focus on Details and the selection kept', () => {
    const { editor, click, details } = mount();
    expect(details()).toHaveAttribute('aria-expanded', 'false');
    expect(details()).toHaveAttribute('aria-controls', 'details-sheet');
    expect(sheet()).not.toBeVisible();
    click(details());
    expect(details()).toHaveAttribute('aria-expanded', 'true');
    const region = screen.getByRole('region', { name: 'Details' });
    expect(region).toBe(sheet());
    expect(within(region).getByRole('heading', { name: 'Rectangle' })).toBeInTheDocument();
    expect(region.querySelectorAll('dl dd')).toHaveLength(5);
    expect(region).toHaveTextContent('Style controls are not in this build.');
    expect(region.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(0);
    const close = screen.getByRole('button', { name: 'Close Details' });
    expect(close).toHaveFocus();
    click(close);
    expect([details().getAttribute('aria-expanded'), document.activeElement]).toEqual([
      'false',
      details(),
    ]);
    const selected = editor.view.selection;
    click(details());
    act(() => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Close Details' }), {
        key: 'Escape',
        code: 'Escape',
      });
    });
    expect([details().getAttribute('aria-expanded'), document.activeElement]).toEqual([
      'false',
      details(),
    ]);
    // The Escape went no further: the selection, which Escape on the canvas clears, stays.
    expect(editor.view.selection).toBe(selected);
  });

  it('D4 A7 is never open with the Elements sheet, the one that opens taking the focus', () => {
    const { click, details } = mount();
    const toggle = screen.getByRole('button', { name: 'Elements' });
    click(toggle);
    expect(screen.getByRole('listbox', { name: 'Elements' })).toHaveFocus();
    click(details());
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close Details' })).toHaveFocus();
    click(toggle);
    expect(details()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('listbox', { name: 'Elements' })).toHaveFocus();
    click(details());
    click(screen.getByRole('button', { name: 'Planewright menu' }));
    click(screen.getByRole('menuitemcheckbox', { name: 'Show elements' }));
    expect(details()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('listbox', { name: 'Elements' })).toHaveFocus();
  });

  it('D4 A7 closes when the selection empties, the focus going to the canvas, and a later selection shows it closed', () => {
    const { editor, click, details } = mount();
    click(details());
    expect(screen.getByRole('button', { name: 'Close Details' })).toHaveFocus();
    const [rectangle] = editor.view.selection;
    act(() => {
      editor.select([]);
    });
    expect([sheet(), document.querySelector('[data-island="selection"]')]).toEqual([null, null]);
    expect(document.activeElement).toBe(document.getElementById(CANVAS_ID));
    act(() => {
      editor.select(rectangle === undefined ? [] : [rectangle]);
    });
    expect(details()).toHaveAttribute('aria-expanded', 'false');
    expect(sheet()).not.toBeVisible();
  });

  it('D4 A7 closes when a text session starts, the text area taking the focus, and when the window leaves the phone’s query', () => {
    const { editor, click, details, change } = mount(drawText);
    click(details());
    act(() => {
      editor.run('canvas.enter');
    });
    expect(sheet()).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveFocus();
    act(() => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Text' }), { key: 'Escape' });
    });
    expect(details()).toHaveAttribute('aria-expanded', 'false');
    click(details());
    expect(sheet()).toBeVisible();
    change(false);
    expect(sheet()).toBeNull();
    expect(document.querySelector('[data-island="selection"]')).toHaveClass('selection-panel');
    change(true);
    expect(details()).toHaveAttribute('aria-expanded', 'false');
    expect(sheet()).not.toBeVisible();
  });

  it('D4 A7 makes the tool bar and the bottom islands inert while it is open, never the bar', () => {
    const { click, details } = mount();
    expect(inert()).toEqual([]);
    click(details());
    expect(inert()).toEqual(['tools', 'bottom-left', 'bottom-right']);
    expect(details().closest('[inert]')).toBeNull();
    click(screen.getByRole('button', { name: 'Close Details' }));
    expect(inert()).toEqual([]);
  });

  it('D4 A7 is closed at every mount, and opening or closing it writes nothing to storage', () => {
    const written = vi.spyOn(Storage.prototype, 'setItem');
    onTestFinished(() => {
      written.mockRestore();
    });
    const first = mount();
    first.click(first.details());
    first.click(first.details());
    first.click(first.details());
    expect(first.details()).toHaveAttribute('aria-expanded', 'true');
    cleanup();
    const second = mount();
    expect(second.details()).toHaveAttribute('aria-expanded', 'false');
    expect(sheet()).not.toBeVisible();
    expect([written.mock.calls, localStorage.length, sessionStorage.length]).toEqual([[], 0, 0]);
  });
});
