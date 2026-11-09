import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { useEditorView, useSurface } from '../surface.ts';
import { endsSession, textAreaStyle } from './text-area.ts';

// The text-editing overlay (ADR 0006 decision 6, docs/architecture/engine/interaction.md#text-editing):
// while a text is edited, a text area shows it where the canvas would, in its font scaled by the
// zoom and turned by its rotation, and the scene layer leaves it out. The area sits outside the
// canvas host, so its pointer and key events never reach the editor, whose shortcuts pause.

/**
 * The text area of the text being edited, focused when its session starts; nothing otherwise. When
 * a key in it ends the session, the canvas host, which opened it, takes the focus back, so its
 * shortcuts work again (REQ-Y02). When the focus moves to another control, as Tab moves it, the
 * session ends too, so that it never stays open behind the control; when the page itself loses the
 * focus, the session stays.
 */
export function TextEditor({ host }: { readonly host: RefObject<HTMLElement | null> }) {
  const { editor, platform } = useSurface();
  const { text, camera } = useEditorView();
  const area = useRef<HTMLTextAreaElement>(null);
  const id = text?.element.id;
  useEffect(() => {
    if (id !== undefined) area.current?.focus({ preventScroll: true });
  }, [id]);
  if (text === null) return null;
  return (
    <textarea
      ref={area}
      className="text-editor"
      aria-label="Text"
      value={text.element.content.text}
      maxLength={100_000}
      wrap="off"
      spellCheck={false}
      style={textAreaStyle(text, camera.zoom)}
      onChange={(event) => {
        editor.editText({ type: 'value', text: event.target.value });
      }}
      onBlur={(event) => {
        if (event.relatedTarget !== null) editor.editText({ type: 'commit' });
      }}
      onKeyDown={(event) => {
        if (!endsSession(event.nativeEvent, platform)) return;
        event.preventDefault();
        editor.editText({ type: 'commit' });
        host.current?.focus({ preventScroll: true });
      }}
    />
  );
}
