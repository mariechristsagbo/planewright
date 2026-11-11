import type { ArrowElement, Color, DocumentId, Editor, Element } from '@planewright/engine';
import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { drawnKinds } from '../support/elements.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The selection panel (ADR 0012, decisions 1, 2, 13 and 14; the v0.2 plan's S6, issue #69's D2):
// mounted only with a selection and no text session, a group named by its heading, read-only
// figures and a footnote, and no live region. Its actions, focus and render counts are in
// SelectionPanel-actions.test.tsx.

const FOOTNOTE = 'Style controls are not in this build.';

/** The panel, if it is in the page. */
const panel = (): HTMLElement | null => document.querySelector('[data-island="selection"]');

/** The panel, which must be in the page. */
function shown(): HTMLElement {
  const element = panel();
  if (element === null) throw new Error('No selection panel.');
  return element;
}

const act$ = (change: () => void): void => {
  act(change);
};

/** Draws one element of each P0 kind at the centre of an 800 × 600 canvas, in that order. */
function drawAll(editor: Editor): void {
  for (const tool of ['tool.rectangle', 'tool.ellipse', 'tool.diamond', 'tool.line'] as const) {
    editor.run(tool);
    editor.run('canvas.enter');
  }
  editor.run('tool.freehand');
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
  const select = (index: number): void => {
    act$(() => {
      const element = harness.editor.view.elements[index];
      harness.editor.select(element === undefined ? [] : [element.id]);
    });
  };
  return { ...harness, select };
}

/** The panel's figures, as terms, values and the hidden words of short terms. */
const figures = (): string[][] =>
  [...shown().querySelectorAll('dl > div')].map((pair) => [
    pair.querySelector('dt [aria-hidden="true"]')?.textContent ??
      pair.querySelector('dt')?.textContent ??
      '',
    pair.querySelector('dd')?.textContent ?? '',
    pair.querySelector('dt .visually-hidden')?.textContent ?? '',
  ]);

describe('the selection panel', () => {
  it('D2 A3 shows only with a selection and no text session, and never for kinds that P0 does not draw', () => {
    const { editor, select } = mount();
    expect(panel()).toBeNull();
    act$(() => {
      drawAll(editor);
    });
    // The text stays selected after its session.
    expect(screen.getByRole('group', { name: 'Text' })).toBe(shown());
    select(0);
    expect(screen.getByRole('group', { name: 'Rectangle' })).toBe(shown());
    act$(() => {
      editor.select(editor.view.elements.slice(0, 3).map(({ id }) => id));
    });
    expect(screen.getByRole('group', { name: '3 elements' })).toBe(shown());
    // Enter edits the selected text again, a session that starts with nothing selected; a
    // selection made while it lasts shows no panel either.
    const [rectangle, , , , , text] = editor.view.elements.map(({ id }) => id);
    select(5);
    act$(() => {
      editor.run('canvas.enter');
    });
    expect([editor.view.text?.element.id, panel()]).toEqual([text, null]);
    act$(() => {
      editor.select(rectangle === undefined ? [] : [rectangle]);
    });
    expect([editor.view.text?.element.id, editor.view.selection]).toEqual([text, [rectangle]]);
    expect(panel()).toBeNull();
    act$(() => {
      editor.editText({ type: 'commit' });
    });
    expect(editor.view.text).toBeNull();
    expect(panel()).not.toBeNull();
    act$(() => {
      editor.select([]);
    });
    expect(panel()).toBeNull();
  });

  it('D2 shows nothing for a selection of a kind that the view does not list, and no Edit text for a text selected with one', () => {
    const { line, text } = drawnKinds();
    const arrow: ArrowElement = {
      ...line,
      kind: 'arrow',
      heads: { start: 'none', end: 'arrow' },
      route: 'straight',
    };
    const harness = surfaceHarness('other', {
      id: 'AAAAAAAAAAAAAAAAAAAAAD' as DocumentId,
      rev: 0,
      document: {
        elements: new Map<ArrowElement['id'], Element>([
          [arrow.id, arrow],
          [text.id, text],
        ]),
        groups: new Map(),
        canvas: { background: '#ffffff' as Color },
        rev: 0,
      },
      session: { camera: { x: 0, y: 0, zoom: 1 }, selection: [arrow.id] },
    });
    const { editor } = harness;
    render(<EditorShell surface={harness.surface} />);
    expect([editor.view.selection, editor.view.elements]).toEqual([[arrow.id], [text]]);
    expect(panel()).toBeNull();
    // The view lists the text alone, whose figures show; Enter, with two elements selected, edits
    // neither, so Edit text does not show.
    act$(() => {
      editor.select([text.id, arrow.id]);
    });
    expect(screen.getByRole('group', { name: 'Text' })).toBe(shown());
    expect(within(shown()).queryByRole('button', { name: 'Edit text' })).toBeNull();
    act$(() => {
      editor.run('canvas.enter');
    });
    expect(editor.view.text).toBeNull();
  });

  it('D2 heads the panel with the kind’s glyph and name, or the multiple glyph and the count', () => {
    const { editor, select } = mount();
    act$(() => {
      drawAll(editor);
    });
    const kinds = ['Rectangle', 'Ellipse', 'Diamond', 'Line', 'Freehand stroke', 'Text'];
    const glyphs = ['rectangle', 'ellipse', 'diamond', 'line', 'freehand', 'text'];
    for (const [index, name] of kinds.entries()) {
      select(index);
      const heading = within(shown()).getByRole('heading', { name });
      expect(heading.querySelector('svg')?.getAttribute('data-glyph')).toBe(glyphs[index]);
      expect(heading.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(shown()).toHaveAccessibleName(name);
    }
    act$(() => {
      editor.select(editor.view.elements.map(({ id }) => id));
    });
    const heading = within(shown()).getByRole('heading', { name: '6 elements' });
    expect(heading.querySelector('svg')?.getAttribute('data-glyph')).toBe('multiple');
  });

  it('D2 A3 shows read-only figures in a description list, values in mono, W and H with their words hidden', () => {
    const { editor, select } = mount();
    act$(() => {
      drawAll(editor);
    });
    select(0);
    expect(figures()).toEqual([
      ['X', '350', ''],
      ['Y', '250', ''],
      ['W', '100', 'Width'],
      ['H', '100', 'Height'],
      ['Angle', '0°', ''],
    ]);
    for (const value of shown().querySelectorAll('dd'))
      expect(value).toHaveClass('selection-value');
    expect(
      shown().querySelectorAll('input, textarea, select, [contenteditable], [readonly]'),
    ).toHaveLength(0);
    select(3);
    expect(figures().slice(4)).toEqual([
      ['Angle', '0°', ''],
      ['Length', '100', ''],
    ]);
    select(4);
    expect(figures().slice(5)).toEqual([['Points', '1', '']]);
    select(5);
    expect(figures().slice(5)).toEqual([['Lines', '1', '']]);
    act$(() => {
      editor.select(editor.view.elements.slice(0, 2).map(({ id }) => id));
    });
    expect(figures().map(([term]) => term)).toEqual(['X', 'Y', 'W', 'H']);
  });

  it('D2 A3 ends with the footnote, a line that is no control, and holds no live region', () => {
    const { editor } = mount();
    act$(() => {
      editor.run('tool.rectangle');
      editor.run('canvas.enter');
    });
    const footnote = within(shown()).getByText(FOOTNOTE);
    expect(footnote.tagName).toBe('P');
    expect(footnote.closest('a, button')).toBeNull();
    expect(shown().lastElementChild).toBe(footnote);
    expect(shown()).not.toHaveAttribute('aria-live');
    expect(
      shown().querySelectorAll('[aria-live], [role="status"], [role="alert"], output'),
    ).toHaveLength(0);
    expect(shown().closest('[aria-live]')).toBeNull();
  });
});
