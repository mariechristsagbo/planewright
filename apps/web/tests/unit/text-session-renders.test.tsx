import type { Editor } from '@planewright/engine';
import { act, render } from '@testing-library/react';
import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { textAreaStyle } from '../../src/editor/text/text-area.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { useKeyboardInset } from '../../src/shell/keyboard-inset.ts';
import { useShellState } from '../../src/shell/shell-state.ts';
import { itemsOf } from '../../src/ui/tool-items.ts';
import { hasNotices, problemChipOf, saveStateOf } from '../../src/ui/save-problem.ts';
import { startText } from '../support/session.ts';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';
import { emulateKeyboard } from '../support/visual-viewport.ts';

// What a text session's camera steps and typed values render (ADR 0012, decision 14; the v0.2
// plan's S9, issue #75's D13): the shell reads whether a text is edited through a selector, which
// neither a camera step nor a typed value changes, so neither renders the shell, its root, the tool
// bar, the problem chip, the notices or the Done bar, while the text area renders at each view, as
// on main; and the Done bar follows the visual viewport outside React, so that a resize or a scroll
// of it renders nothing. Each is counted by the call it makes at each render: the shell's
// useShellState, the root's saveStateOf, the tool bar's itemsOf, the chip's problemChipOf, the
// chip's and the notices' hasNotices, the Done bar's useKeyboardInset and the text area's
// textAreaStyle; a Profiler around the shell counts every commit.

vi.mock(import('../../src/shell/shell-state.ts'), { spy: true });
vi.mock(import('../../src/ui/save-problem.ts'), { spy: true });
vi.mock(import('../../src/ui/tool-items.ts'), { spy: true });
vi.mock(import('../../src/editor/text/text-area.ts'), { spy: true });
vi.mock(import('../../src/shell/keyboard-inset.ts'), { spy: true });

const counted = {
  shell: () => vi.mocked(useShellState),
  root: () => vi.mocked(saveStateOf),
  toolbar: () => vi.mocked(itemsOf),
  chip: () => vi.mocked(problemChipOf),
  notices: () => vi.mocked(hasNotices),
  doneBar: () => vi.mocked(useKeyboardInset),
};

/** The shell over a 390 by 844 canvas, a text session open, and the counts cleared. */
function mountSession(phone: boolean): Editor {
  phoneQuery(phone);
  const { editor, surface } = surfaceHarness();
  render(<EditorShell surface={surface} />);
  act(() => {
    editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  });
  startText(editor);
  expect(editor.view.text).not.toBeNull();
  for (const spy of [...Object.values(counted).map((spy) => spy()), vi.mocked(textAreaStyle)]) {
    spy.mockClear();
  }
  return editor;
}

/** Ten camera steps, zooms by command and pans by the wheel alternately, then ten typed values. */
function stepsAndValues(editor: Editor): void {
  const modifiers = { shift: false, alt: false, mod: false };
  for (let step = 0; step < 10; step += 1) {
    act(() => {
      if (step % 2 === 0) editor.run(step % 4 === 0 ? 'view.zoom-in' : 'view.zoom-out');
      else
        editor.input({
          type: 'wheel',
          at: { x: 200, y: 300 },
          delta: { x: 0, y: 40 },
          zoom: false,
          modifiers,
          time: step,
        });
    });
  }
  for (let value = 1; value <= 10; value += 1) {
    act(() => {
      editor.editText({ type: 'value', text: 'Plan'.repeat(value) });
    });
  }
}

/** How often each counted component rendered over the steps and values. */
function rendersOverSession(phone: boolean) {
  const editor = mountSession(phone);
  const camera = editor.view.camera;
  stepsAndValues(editor);
  expect(editor.view.camera).not.toEqual(camera);
  expect(editor.view.text?.element.content.text).toBe('Plan'.repeat(10));
  return {
    ...Object.fromEntries(
      Object.entries(counted).map(([name, spy]) => [name, spy().mock.calls.length]),
    ),
    textArea: vi.mocked(textAreaStyle).mock.calls.length >= 20,
  };
}

describe('the chrome during a text session, at camera steps and typed values', () => {
  it.each([
    ['a phone in portrait', true],
    ['a desktop', false],
  ] as const)(
    'A17 D13 renders neither the shell, its root, the tool bar, the chip, the notices nor the Done bar on %s, while the text area renders at each view',
    (_name, phone) => {
      expect(rendersOverSession(phone)).toEqual({
        shell: 0,
        root: 0,
        toolbar: 0,
        chip: 0,
        notices: 0,
        doneBar: 0,
        textArea: true,
      });
    },
  );

  it('renders the shell when a session starts and when it ends, so that the counts above can see a render', () => {
    phoneQuery(true);
    const { editor, surface } = surfaceHarness();
    render(<EditorShell surface={surface} />);
    vi.mocked(useShellState).mockClear();
    startText(editor);
    const started = vi.mocked(useShellState).mock.calls.length;
    act(() => {
      editor.editText({ type: 'commit' });
    });
    expect([started > 0, vi.mocked(useShellState).mock.calls.length > started]).toEqual([
      true,
      true,
    ]);
  });

  it('A17 D13 renders no component at a visual viewport’s resize or scroll during a phone’s session', () => {
    const keyboard = emulateKeyboard(844, 844);
    phoneQuery(true);
    const { editor, surface } = surfaceHarness();
    const commits = vi.fn();
    render(
      <Profiler id="shell" onRender={commits}>
        <EditorShell surface={surface} />
      </Profiler>,
    );
    startText(editor);
    const bar = document.querySelector<HTMLElement>('[data-island="done"]');
    expect(bar?.style.getPropertyValue('--kb')).toBe('0px');
    commits.mockClear();
    vi.mocked(useKeyboardInset).mockClear();
    keyboard.move({ height: 508 }, 'resize');
    keyboard.move({ offsetTop: 40 }, 'scroll');
    expect(bar?.style.getPropertyValue('--kb')).toBe('296px');
    expect([commits.mock.calls.length, vi.mocked(useKeyboardInset).mock.calls.length]).toEqual([
      0, 0,
    ]);
  });
});
