import type { Editor } from '@planewright/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
});
