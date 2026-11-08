import type { Element } from '../../src/model/elements.ts';
import type { EditorHarness } from './editors.ts';
import { keyEvent } from './inputs.ts';

// Keys and readings for the creation tests through the editor (ENG-11). At the editor's starting
// camera a scene point is the screen point.

const key = (name: string, code: string, modifiers: Parameters<typeof keyEvent>[3] = {}) =>
  keyEvent('key-down', name, code, modifiers);

export const KEYS = {
  selection: key('v', 'KeyV'),
  rectangle: key('r', 'KeyR'),
  ellipse: key('o', 'KeyO'),
  diamond: key('d', 'KeyD'),
  line: key('l', 'KeyL'),
  freehand: key('p', 'KeyP'),
  lock: key('q', 'KeyQ'),
  undo: key('z', 'KeyZ', { mod: true }),
  redo: key('z', 'KeyZ', { mod: true, shift: true }),
  redoY: key('y', 'KeyY', { mod: true }),
  selectAll: key('a', 'KeyA', { mod: true }),
  escape: key('Escape', 'Escape'),
} as const;

/**
 * Reads the elements as a renderer is handed them: the last frame that redrew the scene layer
 * lists every visible element, in drawing order.
 */
export function shownElements({ next }: Pick<EditorHarness, 'next'>): () => readonly Element[] {
  let shown: readonly Element[] = [];
  return () => {
    const scene = next().findLast((frame) => frame.scene !== undefined)?.scene;
    if (scene !== undefined) shown = scene.elements;
    return shown;
  };
}
