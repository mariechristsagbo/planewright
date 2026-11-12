import { useCallback, useRef } from 'react';
import type { SyntheticEvent } from 'react';

import { focusCanvas } from '../a11y/focus.ts';
import { useSurface } from '../editor/surface.ts';
import { blurCommits, DONE_ID, TEXT_EDITOR_ID } from '../editor/text/text-area.ts';
import { useFocusLost } from '../ui/focus-lost.ts';
import { useKeyboardInset } from './keyboard-inset.ts';

/** Keeps a press on the bar from moving the focus, so that the text area and its keyboard stay. */
const keepFocus = (event: SyntheticEvent): void => {
  event.preventDefault();
};

/**
 * The phone's Done bar (the v0.2 plan's S9 and responsive rule 5): along the window's bottom, above
 * the on-screen keyboard (keyboard-inset.ts), while a phone in portrait edits a text. Its one
 * button, Done, commits the text as Escape does and gives the focus to the canvas, during an input
 * method's composition too, since Done is no key of the input method's. A press on the bar keeps
 * the focus where it is, so that the keyboard stays until Done commits. The focus may move between
 * the text area and Done without ending the session; Done's blur to another control ends it, and
 * to no control keeps it, as the text area's does. If Done leaves the page with the focus, as when
 * the window turns, the text area takes it back, or the canvas once the session is over.
 */
export function DoneBar() {
  const { editor } = useSurface();
  const bar = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  useKeyboardInset(bar);
  const rescue = useCallback(() => {
    if (editor.view.text === null) focusCanvas(document);
    else document.getElementById(TEXT_EDITOR_ID)?.focus({ preventScroll: true });
  }, [editor]);
  useFocusLost(done, rescue);
  return (
    <div
      ref={bar}
      className="done-bar"
      data-island="done"
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
    >
      <button
        ref={done}
        id={DONE_ID}
        type="button"
        className="done-button"
        onClick={() => {
          editor.editText({ type: 'commit' });
          focusCanvas(document);
        }}
        onBlur={(event) => {
          if (editor.view.text !== null && blurCommits(event.relatedTarget, TEXT_EDITOR_ID)) {
            editor.editText({ type: 'commit' });
          }
        }}
      >
        Done
      </button>
    </div>
  );
}
