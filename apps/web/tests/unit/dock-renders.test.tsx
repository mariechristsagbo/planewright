import type { Editor } from '@planewright/engine';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { itemsOf } from '../../src/ui/tool-items.ts';
import { surfaceHarness } from '../support/surface.tsx';

// What a camera step renders of the tool bar (ADR 0012, decision 14; the v0.2 plan's S8, issue
// #73's D12): the tool bar reads the active tool and tool lock alone, which keep their identity
// across camera changes, so a pan or zoom step renders it not at all, while the view readout still
// renders at each step. The tool bar is counted by the call it makes at each render, itemsOf.

vi.mock(import('../../src/ui/tool-items.ts'), { spy: true });

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
  vi.mocked(itemsOf).mockClear();
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
    readout: screen.getByText(/^View: /u).textContent !== readout,
  };
}

describe('the tool bar at camera steps', () => {
  it('A15 D12 renders not the palette across ten camera steps, while the readout renders', () => {
    expect(rendersOverCameraSteps(mountShell())).toEqual({ toolbar: 0, readout: true });
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
