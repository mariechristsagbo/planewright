import type { Element } from '../../src/model/elements.ts';
import type { PointerKind } from '../../src/selection/pointer.ts';
import { KEYS, shownElements } from './creation-input.ts';
import { editorHarness } from './editors.ts';
import { doubleTapper, tapper } from './selection-input.ts';
import { boxOf } from './transform-scene.ts';

// The text tests through the editor (ENG-12): a harness that taps with one pointer, types through
// the text session as the web app's text area does, and reads texts as the renderer is handed them.

/** A text's box and content, or undefined for another kind or no element. */
export const textAndBox = (element: Element | undefined) =>
  element?.kind === 'text' ? [element.content.text, boxOf(element)] : undefined;

export function textHarness(pointer: PointerKind) {
  const harness = editorHarness();
  const tap = tapper(pointer);
  const twice = doubleTapper(pointer);
  return {
    ...harness,
    shown: shownElements(harness),
    tap: (x: number, y: number) => {
      harness.feed(...tap(x, y));
    },
    doubleTap: (x: number, y: number) => {
      harness.feed(...twice(x, y));
    },
    /** Chooses the Text tool, taps and types the values in turn. */
    place: (x: number, y: number, ...values: readonly string[]) => {
      harness.feed(KEYS.text, ...tap(x, y));
      for (const text of values) harness.editor.editText({ type: 'value', text });
    },
    type: (text: string) => {
      harness.editor.editText({ type: 'value', text });
    },
    commit: () => {
      harness.editor.editText({ type: 'commit' });
    },
  };
}
