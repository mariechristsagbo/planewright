import type { Editor } from '@planewright/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CanvasFocusChip } from '../../src/shell/CanvasFocusChip.tsx';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { ToolHint } from '../../src/shell/ToolHint.tsx';
import { hintOf } from '../../src/shell/tool-hints.ts';
import { startText } from '../support/session.ts';
import { surfaceHarness } from '../support/surface.tsx';

// What camera steps and typed values render of the canvas's chrome (ADR 0012, decision 14; the
// v0.2 plan's S10, issue #77's D11): the tool hint reads the active tool and whether a text is
// edited, which keep their identity across camera steps and typed values, so neither renders it,
// while the view readout renders at each camera step; a tool change renders it once. The canvas's
// focus ring and chip is one element that the shell builds once, so no view renders it, though the
// canvas host renders at each. The hint and the chip are counted by their own calls, through a spy
// on their modules, and the hint by its calls of hintOf too.

vi.mock(import('../../src/shell/ToolHint.tsx'), { spy: true });
vi.mock(import('../../src/shell/tool-hints.ts'), { spy: true });
vi.mock(import('../../src/shell/CanvasFocusChip.tsx'), { spy: true });

const counted = {
  hint: () => vi.mocked(ToolHint),
  words: () => vi.mocked(hintOf),
  chip: () => vi.mocked(CanvasFocusChip),
};

/** How many times each counted component rendered since the counts were last cleared. */
const counts = () => ({
  hint: counted.hint().mock.calls.length,
  words: counted.words().mock.calls.length,
  chip: counted.chip().mock.calls.length,
});

const clearCounts = (): void => {
  for (const spy of Object.values(counted)) spy().mockClear();
};

/** Ten camera steps, zooms by command and pans by the wheel alternately, each followed by `after`. */
function cameraSteps(editor: Editor, after: () => void = () => undefined): void {
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
    after();
  }
}

/** Ten typed values in the open text session. */
function typedValues(editor: Editor): void {
  for (let value = 1; value <= 10; value += 1) {
    act(() => {
      editor.editText({ type: 'value', text: 'Plan'.repeat(value) });
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
  clearCounts();
  return editor;
}

/** Ten camera steps, which move the camera and render the view readout each time. */
function expectCameraSteps(editor: Editor): void {
  const camera = editor.view.camera;
  const readouts = new Set<string | null>();
  const record = () => readouts.add(screen.getByText(/^View: /u).textContent);
  record();
  cameraSteps(editor, record);
  expect(editor.view.camera).not.toEqual(camera);
  expect(readouts.size).toBe(11);
}

describe('the canvas’s chrome at camera steps and typed values', () => {
  it('A13 D11 renders neither the hint nor the chip across ten camera steps, while the readout renders at each step', () => {
    const editor = mountShell();
    expect(document.getElementById('tool-hint')).not.toBeNull();
    expect(screen.getByText('Canvas focused')).toBeInTheDocument();
    expectCameraSteps(editor);
    expect(counts()).toEqual({ hint: 0, words: 0, chip: 0 });
  });

  it('A13 D11 renders neither the hint nor the chip across ten camera steps and ten typed values during a text session', () => {
    const editor = mountShell();
    startText(editor);
    expect(document.getElementById('tool-hint')).toBeNull();
    clearCounts();
    cameraSteps(editor);
    typedValues(editor);
    expect(editor.view.text?.element.content.text).toBe('Plan'.repeat(10));
    expect(counts()).toEqual({ hint: 0, words: 0, chip: 0 });
  });

  it('D11 renders the hint exactly once for one tool change, so that the counts above can see a render', () => {
    const editor = mountShell();
    act(() => {
      editor.run('tool.rectangle');
    });
    expect(counts()).toEqual({ hint: 1, words: 1, chip: 0 });
  });

  it('D11 renders the chip once, at the shell’s mounting, even as the shell renders again', () => {
    const { editor, surface } = surfaceHarness();
    clearCounts();
    render(<EditorShell surface={surface} />);
    expect(counts().chip).toBe(1);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Elements/u }));
    });
    expect(screen.getByRole('listbox', { name: 'Elements' })).toBeInTheDocument();
    cameraSteps(editor);
    expect(counts().chip).toBe(1);
  });
});
