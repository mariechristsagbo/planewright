import type { Editor } from '@planewright/engine';
import { act } from '@testing-library/react';

// What the text-editing chrome's unit tests share (the v0.2 plan's S9): the shell's tab stops, its
// hidden islands, and a text session opened or ended as the canvas would.

/** The shell's tab stops, in document order, leaving out what is hidden, as EditorShell's tests. */
export const tabStops = (): HTMLElement[] =>
  [
    ...document.querySelectorAll<HTMLElement>('button, a[href], textarea, summary, [tabindex]'),
  ].filter((element) => element.tabIndex >= 0 && element.closest('[hidden]') === null);

/** The islands that carry `hidden`, by name. */
export const hiddenIslands = (): (string | undefined)[] =>
  [...document.querySelectorAll<HTMLElement>('[data-island][hidden]')].map(
    (island) => island.dataset['island'],
  );

/** Opens a new text at the canvas's centre from the keyboard, as Enter with the Text tool does. */
export function startText(editor: Editor): void {
  act(() => {
    editor.run('tool.text');
    editor.run('canvas.enter');
  });
}

/** Draws a text "Plan" from the keyboard, which stays selected with the Selection tool. */
export function drawText(editor: Editor): void {
  act(() => {
    editor.run('tool.text');
    editor.run('canvas.enter');
    editor.editText({ type: 'value', text: 'Plan' });
    editor.editText({ type: 'commit' });
  });
}
