import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditorProvider } from '../../src/editor/EditorProvider.tsx';
import { HistoryControls } from '../../src/ui/HistoryControls.tsx';
import { ViewReadout } from '../../src/ui/ViewReadout.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// Undo and Redo controls and the view readout: what the editor's view says, in named controls.

describe('Undo and Redo', () => {
  it('AC REQ-Y01 start disabled, named, in a History group, with their shortcuts', () => {
    const harness = surfaceHarness();
    render(harness.wrap(<HistoryControls />));
    const group = screen.getByRole('group', { name: 'History' });
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect(group).toContainElement(undo);
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    expect(undo).toHaveAttribute('aria-keyshortcuts', 'Control+Z');
    expect(redo).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+Z Control+Y');
    expect(undo).toHaveAccessibleDescription(
      'Shortcut Ctrl+Z. Undoes the last change to the drawing.',
    );
    expect(redo).toHaveAccessibleDescription(
      'Shortcuts Ctrl+Shift+Z or Ctrl+Y. Redoes the last change that was undone.',
    );
    expect(redo).toHaveAccessibleDescription(/^Shortcuts Ctrl\+Shift\+Z or Ctrl\+Y\./);
  });

  it('AC REQ-V10 REQ-H04 stay disabled while the view pans and zooms', () => {
    const { editor, wrap } = surfaceHarness();
    render(wrap(<HistoryControls />));
    act(() => {
      editor.input({
        type: 'wheel',
        at: { x: 0, y: 0 },
        delta: { x: 0, y: 50 },
        zoom: false,
        modifiers: { shift: false, alt: false, mod: false },
        time: 0,
      });
      editor.run('view.zoom-in');
      editor.run('view.zoom-reset');
    });
    expect(editor.view.camera.y).not.toBe(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('follow the history and run their commands, with Cmd on Apple platforms', () => {
    const harness = surfaceHarness('apple');
    const run = vi.fn(() => 'done' as const);
    const view = { ...harness.editor.view, canUndo: true, canRedo: true };
    const editor = { ...harness.editor, view, run };
    render(
      <EditorProvider surface={{ ...harness.surface, editor }}>
        <HistoryControls />
      </EditorProvider>,
    );
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect([undo, redo].map((button) => (button as HTMLButtonElement).disabled)).toEqual([
      false,
      false,
    ]);
    fireEvent.click(undo);
    fireEvent.click(redo);
    expect(run.mock.calls).toEqual([['history.undo'], ['history.redo']]);
    expect(undo).toHaveAttribute('aria-keyshortcuts', 'Meta+Z');
    expect(undo).toHaveAccessibleDescription(/^Shortcut Cmd\+Z\./);
  });
});

describe('the view readout', () => {
  it('shows the camera’s position to one decimal and its zoom in per cent', () => {
    const { editor, wrap } = surfaceHarness();
    editor.resize({ width: 1280, height: 720, pixelRatio: 1 });
    render(wrap(<ViewReadout />));
    expect(screen.getByText('View: x 0, y 0, zoom 100%')).toBeInTheDocument();
    act(() => {
      editor.run('view.zoom-in');
    });
    expect(screen.getByText('View: x 58.2, y 32.7, zoom 110%')).toBeInTheDocument();
    act(() => {
      editor.input({
        type: 'wheel',
        at: { x: 0, y: 0 },
        delta: { x: -64.02, y: 0 },
        zoom: false,
        modifiers: { shift: false, alt: false, mod: false },
        time: 0,
      });
    });
    expect(screen.getByText('View: x 0, y 32.7, zoom 110%')).toBeInTheDocument();
  });
});
