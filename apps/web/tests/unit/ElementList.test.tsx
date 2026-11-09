import type { Editor } from '@planewright/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ElementList } from '../../src/a11y/ElementList.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The element list (docs/architecture/engine/quality.md#accessibility, REQ-Y05): a list box of the
// drawn elements, topmost first, operated from the keyboard, whose selection is the editor's.

/** Draws one element of each tool at the centre of an 800 × 600 canvas, then the next ones. */
function draw(editor: Editor, tools: readonly ('rectangle' | 'ellipse' | 'line')[]): void {
  editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  for (const tool of tools) {
    editor.run(`tool.${tool}`);
    editor.run('canvas.enter');
  }
  editor.select([]);
}

function mount(tools: readonly ('rectangle' | 'ellipse' | 'line')[] = []) {
  const harness = surfaceHarness();
  draw(harness.editor, tools);
  render(harness.wrap(<ElementList />));
  const list = screen.getByRole('listbox', { name: 'Elements' });
  const press = (key: string, init: Partial<KeyboardEventInit> = {}) => {
    act(() => {
      fireEvent.keyDown(list, { key, code: key, ...init });
    });
  };
  const names = () =>
    within(list)
      .queryAllByRole('option')
      .map((option) => option.textContent);
  const active = () => {
    const id = list.getAttribute('aria-activedescendant');
    return id === null ? null : document.getElementById(id)?.textContent;
  };
  const xs = () => harness.editor.view.elements.map(({ x }) => x);
  return { ...harness, list, press, names, active, xs };
}

describe('the element list', () => {
  it('REQ-Y05 is a focusable, multi-selectable list box named Elements, with its keys described', () => {
    const { list, names } = mount();
    expect(list).toHaveAttribute('aria-multiselectable', 'true');
    expect(list).toHaveAttribute('tabindex', '0');
    expect(list).toHaveAccessibleDescription(
      'Nothing is drawn yet. Up and Down move through the elements; Space adds one to the selection or takes it out, Enter selects it alone, Delete deletes the selection, and Alt+arrow keys nudge it, by 10 with Shift.',
    );
    expect([names(), list.hasAttribute('aria-activedescendant')]).toEqual([[], false]);
  });

  it('REQ-Y05 lists the drawn elements topmost first, each named, with its set size and position', () => {
    const { list, names, active } = mount(['rectangle', 'ellipse', 'line']);
    expect(names()).toEqual([
      'Line, 100 by 0, at 350, 300',
      'Ellipse, 100 by 100, at 350, 250',
      'Rectangle, 100 by 100, at 350, 250',
    ]);
    const options = within(list).getAllByRole('option');
    expect(options.map((option) => option.getAttribute('aria-posinset'))).toEqual(['1', '2', '3']);
    expect(options.every((option) => option.getAttribute('aria-setsize') === '3')).toBe(true);
    expect(active()).toBe('Line, 100 by 0, at 350, 300');
    expect(list).toHaveAccessibleDescription(/^Up and Down move through the elements;/u);
  });

  it('REQ-Y05 moves with Up, Down, Home and End, and Left and Right do nothing', () => {
    const { press, active, xs } = mount(['rectangle', 'ellipse', 'line']);
    press('ArrowDown');
    expect(active()).toMatch(/^Ellipse/u);
    press('ArrowDown');
    press('ArrowDown');
    expect(active()).toMatch(/^Rectangle/u);
    press('Home');
    expect(active()).toMatch(/^Line/u);
    press('ArrowUp');
    expect(active()).toMatch(/^Line/u);
    press('End');
    press('ArrowLeft');
    press('ArrowRight');
    expect([active(), xs()]).toEqual(['Rectangle, 100 by 100, at 350, 250', [350, 350, 350]]);
  });

  it('REQ-Y05 Space toggles the active element in the selection and Enter selects it alone, shared with the canvas', () => {
    const { editor, list, press } = mount(['rectangle', 'ellipse', 'line']);
    const [rectangle, ellipse, line] = editor.view.elements.map(({ id }) => id);
    press(' ');
    press('ArrowDown');
    press(' ');
    expect(editor.view.selection).toEqual([line, ellipse]);
    press(' ');
    expect(editor.view.selection).toEqual([line]);
    press('End');
    press('Enter');
    expect(editor.view.selection).toEqual([rectangle]);
    act(() => {
      editor.select([ellipse ?? '']);
    });
    const selected = within(list)
      .getAllByRole('option')
      .map((option) => option.getAttribute('aria-selected'));
    expect(selected).toEqual(['false', 'true', 'false']);
  });

  it('REQ-Y05 REQ-T10 Alt+arrow keys nudge the selection by 1, and by 10 with Shift', () => {
    const { editor, press, xs } = mount(['rectangle', 'ellipse']);
    press('Enter');
    press('ArrowRight', { altKey: true });
    press('ArrowDown', { altKey: true, shiftKey: true });
    expect(editor.view.elements[1]).toMatchObject({ x: 351, y: 260 });
    expect(xs()).toEqual([350, 351]);
    press('z', { ctrlKey: true, code: 'KeyZ' });
    expect(xs()).toEqual([350, 351]);
    expect(editor.view.elements[1]?.y).toBe(250);
  });

  it('REQ-Y05 REQ-T09 Delete deletes the selection, the next element becomes active and the list keeps the focus', () => {
    const { editor, list, press, names, active } = mount(['rectangle', 'ellipse', 'line']);
    act(() => {
      list.focus();
    });
    press('ArrowDown');
    press('Enter');
    press('Delete');
    expect([names(), active()]).toEqual([
      ['Line, 100 by 0, at 350, 300', 'Rectangle, 100 by 100, at 350, 250'],
      'Rectangle, 100 by 100, at 350, 250',
    ]);
    press('a', { ctrlKey: true, code: 'KeyA' });
    press('Backspace');
    expect([names(), editor.view.elements, document.activeElement]).toEqual([[], [], list]);
    expect(list).toHaveAccessibleDescription(/^Nothing is drawn yet\./u);
  });

  it('REQ-Y05 Escape and other shortcuts reach the editor from the list', () => {
    const { editor, press } = mount(['rectangle', 'ellipse']);
    press('a', { ctrlKey: true, code: 'KeyA' });
    expect(editor.view.selection).toHaveLength(2);
    press('Escape');
    press('r', { code: 'KeyR' });
    expect([editor.view.selection, editor.view.tool]).toEqual([[], 'rectangle']);
  });

  it('REQ-Y05 a click selects an element alone, and a Shift or Mod click adds or takes it out', () => {
    const { editor, list, active } = mount(['rectangle', 'ellipse', 'line']);
    const [rectangle, ellipse] = editor.view.elements.map(({ id }) => id);
    const option = (name: RegExp) => within(list).getByRole('option', { name });
    act(() => {
      fireEvent.click(option(/^Rectangle/u));
    });
    act(() => {
      fireEvent.click(option(/^Ellipse/u), { shiftKey: true });
    });
    expect([editor.view.selection, active()]).toEqual([
      [rectangle, ellipse],
      'Ellipse, 100 by 100, at 350, 250',
    ]);
    act(() => {
      fireEvent.click(option(/^Rectangle/u), { ctrlKey: true });
    });
    expect(editor.view.selection).toEqual([ellipse]);
  });

  it('REQ-Y05 renders only the options near the active one of a large drawing', () => {
    const { list, press, active } = mount(Array.from({ length: 150 }, () => 'rectangle' as const));
    const positions = () =>
      within(list)
        .getAllByRole('option')
        .map((option) => Number(option.getAttribute('aria-posinset')));
    expect([positions().length, positions()[0], positions().at(-1)]).toEqual([101, 1, 101]);
    press('End');
    expect([positions().length, positions()[0], positions().at(-1)]).toEqual([101, 50, 150]);
    press('Home');
    for (let step = 0; step < 75; step += 1) press('ArrowDown');
    expect([positions()[0], positions().at(-1)]).toEqual([26, 126]);
    expect(within(list).getAllByRole('option')[0]).toHaveAttribute('aria-setsize', '150');
    expect(active()).toMatch(/^Rectangle/u);
  });
});
