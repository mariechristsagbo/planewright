import type { Editor } from '@planewright/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CANVAS_ID } from '../../src/a11y/focus.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { selectionGeometry } from '../../src/shell/selection/geometry.ts';
import { SelectionPanel } from '../../src/shell/selection/SelectionPanel.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The selection panel's actions (issue #69's D2, A4, A5 and A8): Duplicate, Delete and Edit text
// each run their existing command through editor.run, named and described from the registry; Edit
// text shows only where canvas.enter edits the lone selected text; Delete, or the panel going with
// the focus inside it, leaves the focus on the canvas; and a camera step renders the panel not at all.

// The geometry is spied on, not replaced, to count how often the panel works it out.
vi.mock(import('../../src/shell/selection/geometry.ts'), { spy: true });

const panel = (): HTMLElement | null => document.querySelector('[data-island="selection"]');

/** A button of the panel, if it shows. */
function action(name: string): HTMLElement | null {
  const shown = panel();
  return shown === null ? null : within(shown).queryByRole('button', { name });
}

/** A button of the panel, which must show. */
function button(name: string): HTMLElement {
  const found = action(name);
  if (found === null) throw new Error(`No ${name} in the panel.`);
  return found;
}

const press = (name: string): void => {
  act(() => {
    fireEvent.click(button(name));
  });
};

/** Draws a rectangle, then a text from the keyboard, which stays selected with the Selection tool. */
function drawRectangleAndText(editor: Editor): void {
  editor.run('tool.rectangle');
  editor.run('canvas.enter');
  editor.run('tool.text');
  editor.run('canvas.enter');
  editor.editText({ type: 'value', text: 'Plan' });
  editor.editText({ type: 'commit' });
}

function mount() {
  const harness = surfaceHarness();
  harness.editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  render(<EditorShell surface={harness.surface} />);
  act(() => {
    drawRectangleAndText(harness.editor);
  });
  return harness;
}

describe('the selection panel’s actions', () => {
  it('D2 A3 offer Edit text exactly where canvas.enter edits the lone selected text', () => {
    const { editor } = mount();
    const [, text] = editor.view.elements.map(({ id }) => id);
    /** Whether canvas.enter, run now, opens the selected text; the session it opens is ended. */
    const entersText = (): boolean => {
      let edits = false;
      act(() => {
        editor.run('canvas.enter');
        edits = editor.view.text !== null && editor.view.text.element.id === text;
        if (editor.view.text !== null) editor.editText({ type: 'commit' });
      });
      return edits;
    };
    const state = (): [string | null, boolean, boolean] => [
      editor.view.tool,
      action('Edit text') !== null,
      action('Duplicate') !== null,
    ];
    expect(state()).toEqual(['selection', true, true]);
    expect(entersText()).toBe(true);
    // With the Hand tool the text stays selected, and Enter does nothing.
    act(() => {
      editor.run('tool.hand');
    });
    expect(state()).toEqual(['hand', false, true]);
    expect(entersText()).toBe(false);
    // A text among several elements is not edited by Enter.
    act(() => {
      editor.run('tool.selection');
      editor.select(editor.view.elements.map(({ id }) => id));
    });
    expect(state()).toEqual(['selection', false, true]);
    expect(entersText()).toBe(false);
    // Tool lock keeps the Text tool, under which a text selected by Select all or the list is not
    // what Enter edits: Enter creates another text.
    act(() => {
      editor.run('tool.lock');
      editor.run('tool.text');
      editor.select(editor.view.elements.slice(1, 2).map(({ id }) => id));
    });
    expect(state()).toEqual(['text', false, true]);
    expect(entersText()).toBe(false);
  });

  it('D2 A4 run exactly their own command through editor.run', () => {
    const { editor } = mount();
    const ran = vi.spyOn(editor, 'run');
    press('Duplicate');
    expect(ran.mock.calls).toEqual([['selection.duplicate']]);
    expect(editor.view.elements).toHaveLength(3);
    const copy = editor.view.elements[2]?.id;
    expect(editor.view.selection).toEqual([copy]);
    ran.mockClear();
    press('Edit text');
    expect(ran.mock.calls).toEqual([['canvas.enter']]);
    expect(editor.view.text?.element.id).toBe(copy);
    act(() => {
      editor.editText({ type: 'commit' });
    });
    ran.mockClear();
    press('Delete');
    expect(ran.mock.calls).toEqual([['selection.delete']]);
    expect(editor.view.elements.map(({ id }) => id)).not.toContain(copy);
    expect(panel()).toBeNull();
  });

  it('D2 A4 take Duplicate’s and Delete’s names, keys, descriptions and tips from the registry, and give Edit text none', () => {
    mount();
    const expected = [
      ['Duplicate', 'duplicate', 'Control+D', 'Shortcut Ctrl+D.', 'Ctrl+D'],
      [
        'Delete',
        'delete',
        'Delete Backspace',
        'Shortcuts Delete or Backspace.',
        'Delete or Backspace',
      ],
    ];
    for (const [name = '', glyph, aria, description, keys] of expected) {
      const control = button(name);
      expect(control).toHaveTextContent(name);
      expect(control.querySelector('svg')?.getAttribute('data-glyph')).toBe(glyph);
      expect(control).toHaveAttribute('aria-keyshortcuts', aria);
      expect(control).toHaveAccessibleDescription(description);
      expect([control.dataset['chromeTip'], control.dataset['chromeKeys']]).toEqual([name, keys]);
    }
    const edit = button('Edit text');
    expect(edit).toHaveTextContent('Edit text');
    expect(edit.querySelector('svg')?.getAttribute('data-glyph')).toBe('edit-text');
    expect(edit).not.toHaveAttribute('aria-keyshortcuts');
    expect(edit).toHaveAccessibleDescription(/Enter on the canvas does the same/u);
    expect([edit.dataset['chromeTip'], edit.dataset['chromeKeys']]).toEqual([
      'Edit text',
      undefined,
    ]);
    expect(
      within(panel() ?? document.body)
        .getAllByRole('button')
        .map((each) => each.textContent),
    ).toEqual(['Duplicate', 'Delete', 'Edit text']);
  });

  it('D2 A5 keep the focus on Duplicate, give it to the text area for Edit text and to the canvas after Delete', () => {
    const { editor } = mount();
    const canvas = document.getElementById(CANVAS_ID);
    const duplicate = button('Duplicate');
    act(() => {
      duplicate.focus();
    });
    press('Duplicate');
    expect(duplicate).toHaveFocus();
    act(() => {
      button('Edit text').focus();
    });
    press('Edit text');
    const area = screen.getByRole('textbox', { name: 'Text' });
    expect(area).toHaveFocus();
    act(() => {
      fireEvent.keyDown(area, { key: 'Escape', code: 'Escape' });
    });
    expect(canvas).toHaveFocus();
    act(() => {
      button('Delete').focus();
    });
    press('Delete');
    expect(panel()).toBeNull();
    expect(canvas).toHaveFocus();
    // The panel going for any other reason with the focus inside it gives the focus to the canvas.
    act(() => {
      editor.select(editor.view.elements.slice(0, 1).map(({ id }) => id));
    });
    act(() => {
      button('Duplicate').focus();
    });
    act(() => {
      editor.select([]);
    });
    expect(canvas).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('A8 renders the panel not at all across ten camera steps, and works out its geometry only when the elements or the selection change', () => {
    const harness = surfaceHarness();
    const { editor } = harness;
    editor.resize({ width: 800, height: 600, pixelRatio: 1 });
    act(() => {
      drawRectangleAndText(editor);
    });
    const commits = vi.fn();
    render(
      harness.wrap(
        <Profiler id="selection" onRender={commits}>
          <SelectionPanel sheet={false} />
        </Profiler>,
      ),
    );
    expect(panel()).not.toBeNull();
    const worked = vi.mocked(selectionGeometry);
    commits.mockClear();
    worked.mockClear();
    const { elements, selection, camera } = editor.view;
    const modifiers = { shift: false, alt: false, mod: false };
    for (let step = 0; step < 10; step += 1) {
      act(() => {
        if (step % 2 === 0) editor.run(step % 4 === 0 ? 'view.zoom-in' : 'view.zoom-out');
        else
          editor.input({
            type: 'wheel',
            at: { x: 400, y: 300 },
            delta: { x: 0, y: 40 },
            zoom: false,
            modifiers,
            time: step,
          });
      });
    }
    // The premise: every step published a new camera, with the same elements and selection.
    expect(editor.view.camera).not.toEqual(camera);
    expect(editor.view.elements).toBe(elements);
    expect(editor.view.selection).toBe(selection);
    expect([commits.mock.calls.length, worked.mock.calls.length]).toEqual([0, 0]);
    act(() => {
      editor.run('selection.duplicate');
    });
    expect(commits).toHaveBeenCalled();
    expect(worked).toHaveBeenCalled();
  });
});
