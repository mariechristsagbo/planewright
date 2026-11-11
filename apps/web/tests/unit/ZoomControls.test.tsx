import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ZoomControls } from '../../src/ui/ZoomControls.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The zoom controls (docs/architecture/engine/quality.md#accessibility): the last stop of the tab
// order, read from the command registry like the tool bar (REQ-C14, REQ-Y01, REQ-Y02).

/** The name of the glyph that a button shows, if it shows one. */
const glyphOf = (button: HTMLElement): string | null | undefined =>
  button.querySelector('svg[data-glyph]')?.getAttribute('data-glyph');

function mount() {
  const harness = surfaceHarness();
  harness.editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  render(harness.wrap(<ZoomControls />));
  const group = screen.getByRole('group', { name: 'Zoom' });
  const button = (name: string | RegExp) => within(group).getByRole('button', { name });
  return { ...harness, group, button };
}

describe('the zoom controls', () => {
  it('REQ-Y01 REQ-Y02 are four named buttons in a Zoom group, each with its first shortcut', () => {
    const { group, button } = mount();
    // ADR 0012's row for this test: Zoom out, Zoom in and Zoom to fit show glyphs and Reset zoom
    // shows the zoom, so the buttons' accessible names are asserted, not their text.
    const buttons = within(group).getAllByRole('button');
    expect(buttons).toHaveLength(4);
    ['Zoom out', /^Reset zoom, 100%$/u, 'Zoom in', 'Zoom to fit'].forEach((name, index) => {
      expect(buttons[index]).toHaveAccessibleName(name);
    });
    expect(buttons.map(glyphOf)).toEqual(['zoom-out', undefined, 'zoom-in', 'zoom-fit']);
    expect(buttons.map((each) => each.textContent)).toEqual(['', '100%', '', '']);
    expect(button('Zoom in')).toHaveAttribute('aria-keyshortcuts', 'Control+=');
    expect(button('Zoom in')).toHaveAccessibleDescription(
      'Shortcut Ctrl+=. Zooms in one step about the centre of the canvas.',
    );
    expect(button('Zoom out')).toHaveAttribute('aria-keyshortcuts', 'Control+-');
    expect(button(/^Reset zoom/u)).toHaveAccessibleDescription(
      'Shortcut Ctrl+0. Zooms to 100% about the centre of the canvas.',
    );
    expect(button('Zoom to fit')).toHaveAccessibleDescription(
      'Shortcut Shift+1. Zooms and moves the view to show the whole drawing.',
    );
  });

  it('REQ-V02 REQ-V09 zoom the view when pressed, and are never disabled', () => {
    const { editor, group, button } = mount();
    act(() => {
      fireEvent.click(button('Zoom in'));
      fireEvent.click(button('Zoom in'));
    });
    expect(editor.view.camera.zoom).toBe(1.25);
    act(() => {
      fireEvent.click(button('Zoom out'));
    });
    expect(editor.view.camera.zoom).toBe(1.1);
    act(() => {
      fireEvent.click(button(/^Reset zoom/u));
      fireEvent.click(button('Zoom to fit'));
    });
    expect(editor.view.camera.zoom).toBe(1);
    for (const each of within(group).getAllByRole('button')) {
      expect(each).toBeEnabled();
      expect(each).not.toHaveAttribute('aria-disabled');
    }
  });

  it('D4 show the zoom on Reset zoom, named "Reset zoom, 100%" at zoom 1, and follow the zoom', () => {
    const { button } = mount();
    expect(button('Reset zoom, 100%')).toHaveTextContent(/^100%$/u);
    act(() => {
      fireEvent.click(button('Zoom in'));
    });
    expect(button('Reset zoom, 110%')).toHaveTextContent(/^110%$/u);
    act(() => {
      fireEvent.click(button('Reset zoom, 110%'));
    });
    expect(button('Reset zoom, 100%')).toHaveTextContent(/^100%$/u);
  });
});
