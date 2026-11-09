import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ZoomControls } from '../../src/ui/ZoomControls.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The zoom controls (docs/architecture/engine/quality.md#accessibility): the last stop of the tab
// order, read from the command registry like the tool bar (REQ-C14, REQ-Y01, REQ-Y02).

function mount() {
  const harness = surfaceHarness();
  harness.editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  render(harness.wrap(<ZoomControls />));
  const group = screen.getByRole('group', { name: 'Zoom' });
  const button = (name: string) => within(group).getByRole('button', { name });
  return { ...harness, group, button };
}

describe('the zoom controls', () => {
  it('REQ-Y01 REQ-Y02 are four named buttons in a Zoom group, each with its first shortcut', () => {
    const { group, button } = mount();
    expect(
      within(group)
        .getAllByRole('button')
        .map((each) => each.textContent),
    ).toEqual(['Zoom out', 'Reset zoom', 'Zoom in', 'Zoom to fit']);
    expect(button('Zoom in')).toHaveAttribute('aria-keyshortcuts', 'Control+=');
    expect(button('Zoom in')).toHaveAccessibleDescription(
      'Shortcut Ctrl+=. Zooms in one step about the centre of the canvas.',
    );
    expect(button('Zoom out')).toHaveAttribute('aria-keyshortcuts', 'Control+-');
    expect(button('Reset zoom')).toHaveAccessibleDescription(
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
      fireEvent.click(button('Reset zoom'));
      fireEvent.click(button('Zoom to fit'));
    });
    expect(editor.view.camera.zoom).toBe(1);
    for (const each of within(group).getAllByRole('button')) {
      expect(each).toBeEnabled();
      expect(each).not.toHaveAttribute('aria-disabled');
    }
  });
});
