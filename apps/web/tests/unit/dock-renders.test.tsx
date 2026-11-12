import type { Editor } from '@planewright/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { moreCommands, moreFace } from '../../src/shell/more-tools.ts';
import { itemsOf } from '../../src/ui/tool-items.ts';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// What a camera step renders of the tool bar (ADR 0012, decision 14; the v0.2 plan's S8, issue
// #73's D12): the tool bar reads the active tool and tool lock alone, which keep their identity
// across camera changes, so a pan or zoom step renders neither the palette, nor the phone's dock,
// nor More, nor its open popover, while the view readout still renders at each step. Each is
// counted by the call it makes at each render: the tool bar's and the popover's itemsOf, More's
// moreFace and the popover's moreCommands.

vi.mock(import('../../src/ui/tool-items.ts'), { spy: true });
vi.mock(import('../../src/shell/more-tools.ts'), { spy: true });

const counted = () => [vi.mocked(itemsOf), vi.mocked(moreFace), vi.mocked(moreCommands)];

/** Ten camera steps: zooms by command and pans by the wheel, alternately. */
function cameraSteps(editor: Editor): void {
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
}

/** The shell over an 800 by 600 canvas, with the counts cleared. */
function mountShell(): Editor {
  const { editor, surface } = surfaceHarness();
  render(<EditorShell surface={surface} />);
  act(() => {
    editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  });
  for (const spy of counted()) spy.mockClear();
  return editor;
}

/** How many times the counted components rendered over ten camera steps, and the readout after. */
function rendersOverCameraSteps(editor: Editor) {
  const camera = editor.view.camera;
  const readout = screen.getByText(/^View: /u).textContent;
  cameraSteps(editor);
  expect(editor.view.camera).not.toEqual(camera);
  return {
    toolbar: vi.mocked(itemsOf).mock.calls.length,
    more: vi.mocked(moreFace).mock.calls.length,
    popover: vi.mocked(moreCommands).mock.calls.length,
    readout: screen.getByText(/^View: /u).textContent !== readout,
  };
}

describe('the tool bar at camera steps', () => {
  it('A15 D12 renders not the palette across ten camera steps, while the readout renders', () => {
    expect(rendersOverCameraSteps(mountShell())).toEqual({
      toolbar: 0,
      more: 0,
      popover: 0,
      readout: true,
    });
  });

  it('A15 D12 renders neither the dock, More nor its open popover across ten camera steps', () => {
    phoneQuery(true);
    const editor = mountShell();
    act(() => {
      fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), { pointerType: 'touch' });
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
    });
    expect(screen.getByRole('group', { name: 'More' })).toBeInTheDocument();
    expect(counted().map((spy) => spy.mock.calls.length > 0)).toEqual([true, true, true]);
    for (const spy of counted()) spy.mockClear();
    expect(rendersOverCameraSteps(editor)).toEqual({
      toolbar: 0,
      more: 0,
      popover: 0,
      readout: true,
    });
  });

  it('renders the tool bar again when the tool or tool lock changes, so that the count above can see a render', () => {
    const editor = mountShell();
    act(() => {
      editor.run('tool.rectangle');
    });
    const afterTool = vi.mocked(itemsOf).mock.calls.length;
    act(() => {
      editor.run('tool.lock');
    });
    expect([afterTool > 0, vi.mocked(itemsOf).mock.calls.length > afterTool]).toEqual([true, true]);
  });
});
