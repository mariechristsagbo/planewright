import type { Editor } from '@planewright/engine';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { elementName } from '../../src/a11y/element-names.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The Elements drawer (ADR 0012, decisions 9 and 14; the v0.2 plan's S5, issue #66's D2 and D3):
// closed at every load, it mounts no list while it is closed, and while it is open its options are
// memoised on the elements, the selection and the active position, since a camera change, which
// publishes a new view at each pan step, keeps the view's elements and selection as they were.

// The names are spied on, not replaced, to count how often the open list names its options.
vi.mock(import('../../src/a11y/element-names.ts'), { spy: true });

/** Draws rectangles at the centre of an 800 × 600 canvas, then selects nothing. */
function drawn(editor: Editor, count: number): void {
  editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  for (let made = 0; made < count; made += 1) {
    editor.run('tool.rectangle');
    editor.run('canvas.enter');
  }
  editor.select([]);
}

function mount(count = 3) {
  const harness = surfaceHarness();
  drawn(harness.editor, count);
  render(<EditorShell surface={harness.surface} />);
  const toggle = screen.getByRole('button', { name: 'Elements' });
  const click = (element: HTMLElement): void => {
    act(() => {
      fireEvent.click(element);
    });
  };
  return { ...harness, toggle, click };
}

/** What the list puts in the page, hidden or not. */
const mounted = () => ({
  listboxes: document.querySelectorAll('[role="listbox"]').length,
  options: document.querySelectorAll('[role="option"]').length,
  heading: document.getElementById('element-list-heading') !== null,
  help: document.getElementById('element-list-help') !== null,
});

describe('the Elements drawer', () => {
  it('D3 A5 mounts no list while it is closed, and the list again each time it opens', () => {
    const { toggle, click } = mount();
    const drawer = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    const none = { listboxes: 0, options: 0, heading: false, help: false };
    expect(mounted()).toEqual(none);
    expect(drawer?.childElementCount).toBe(0);
    click(toggle);
    expect(mounted()).toEqual({ listboxes: 1, options: 3, heading: true, help: true });
    click(toggle);
    expect(mounted()).toEqual(none);
    click(toggle);
    expect(
      within(screen.getByRole('listbox', { name: 'Elements' })).getAllByRole('option'),
    ).toHaveLength(3);
  });

  it('D3 A5 names the open list’s options again when the elements, the selection or the active position change, never at a camera change', () => {
    const { editor, toggle, click } = mount();
    const named = vi.mocked(elementName);
    /** How many names were made since the last call. */
    const names = (): number => {
      const made = named.mock.calls.length;
      named.mockClear();
      return made;
    };
    names();
    click(toggle);
    expect(names()).toBe(3);
    const { elements, selection, camera } = editor.view;
    act(() => {
      editor.run('view.zoom-in');
    });
    act(() => {
      editor.run('view.zoom-out');
    });
    act(() => {
      editor.run('view.zoom-to-fit');
    });
    // The premise: the view's elements and selection keep their identity across camera changes.
    expect(editor.view.camera).not.toBe(camera);
    expect([editor.view.elements, editor.view.selection]).toEqual([elements, selection]);
    expect(editor.view.elements).toBe(elements);
    expect(editor.view.selection).toBe(selection);
    expect(names()).toBe(0);
    const list = screen.getByRole('listbox', { name: 'Elements' });
    act(() => {
      fireEvent.keyDown(list, { key: 'ArrowDown', code: 'ArrowDown' });
    });
    expect(names()).toBe(3);
    act(() => {
      editor.select(elements.slice(0, 1).map(({ id }) => id));
    });
    expect(names()).toBe(3);
    act(() => {
      editor.run('tool.rectangle');
      editor.run('canvas.enter');
    });
    expect(names()).toBe(4);
  });

  it('D2 A3 puts the focus on the list box when it opens and on the toggle when it closes, by the toggle, its Close or the menu', () => {
    const { toggle, click } = mount();
    const list = () => screen.getByRole('listbox', { name: 'Elements' });
    click(toggle);
    expect(list()).toHaveFocus();
    click(toggle);
    expect(toggle).toHaveFocus();
    click(toggle);
    click(screen.getByRole('button', { name: 'Close Elements' }));
    expect([toggle.getAttribute('aria-expanded'), document.activeElement]).toEqual([
      'false',
      toggle,
    ]);
    const menu = screen.getByRole('button', { name: 'Planewright menu' });
    const show = () => {
      click(menu);
      click(screen.getByRole('menuitemcheckbox', { name: 'Show elements' }));
    };
    show();
    expect(list()).toHaveFocus();
    show();
    expect([toggle.getAttribute('aria-expanded'), document.activeElement]).toEqual([
      'false',
      toggle,
    ]);
  });

  it('D2 A3 shows its keys folded under a summary, which still describe the list box, and its Close before them', () => {
    const { toggle, click } = mount();
    click(toggle);
    const drawer = document.getElementById(toggle.getAttribute('aria-controls') ?? 'none');
    if (drawer === null) throw new Error('No drawer.');
    const keys = drawer.querySelector('details');
    expect(keys?.querySelector('summary')).toHaveTextContent(/^Keys$/u);
    expect(keys).not.toHaveAttribute('open');
    // Chromium describes nothing by what a closed details element holds, so the list box is
    // described by a visually hidden copy of the keys outside it (drawer.spec.ts reads Chromium's).
    const help = screen.getByText(/^Up and Down move/u, { selector: '#element-list-help' });
    expect(help).toHaveClass('visually-hidden');
    expect(help.closest('details')).toBeNull();
    expect(keys?.querySelector('p')).toHaveTextContent(help.textContent);
    expect(screen.getByRole('listbox', { name: 'Elements' })).toHaveAccessibleDescription(
      help.textContent,
    );
    const stops = [...drawer.querySelectorAll('button, summary, [tabindex="0"]')];
    const named = (stop: Element) =>
      stop.getAttribute('aria-label') ?? stop.getAttribute('role') ?? stop.textContent;
    expect(stops.map(named)).toEqual(['Close Elements', 'Keys', 'listbox']);
  });

  it('D4 A4 is closed at every mount, and opening or closing it writes nothing to storage', () => {
    const written = vi.spyOn(Storage.prototype, 'setItem');
    onTestFinished(() => {
      written.mockRestore();
    });
    const first = mount();
    first.click(first.toggle);
    first.click(first.toggle);
    first.click(first.toggle);
    expect(first.toggle).toHaveAttribute('aria-expanded', 'true');
    cleanup();
    const second = mount();
    expect(second.toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect([written.mock.calls, localStorage.length, sessionStorage.length]).toEqual([[], 0, 0]);
  });
});
