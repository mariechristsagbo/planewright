import { screenFromScene } from '../camera/camera.ts';
import { layoutText } from '../geometry/text-layout.ts';
import type { Transaction } from '../history/transaction.ts';
import type { Box, TextElement } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { LIMITS } from '../model/limits.ts';
import { updatesTo } from '../transform/changes.ts';
import { deletionOf } from '../transform/delete.ts';
import type { EditorCore } from './editor-core.ts';
import { commitWith } from './edits.ts';

// Text editing (docs/architecture/engine/interaction.md#text-editing): the engine holds the text
// session, and the web app shows a text area over the canvas and sends each of its values. A
// session is one transaction, so one undo step (REQ-C10).

/** What the text area sends: its whole value after each input, or the end of the session. */
export type TextEdit =
  | { readonly type: 'value'; readonly text: string }
  /** Escape or Mod+Enter in the text area. */
  | { readonly type: 'commit' };

/** The text being edited, as the interface shows it. */
export interface TextEditView {
  /** The text as the document holds it now. */
  readonly element: TextElement;
  /** Its unrotated box on screen, in CSS pixels from the canvas's top-left corner. */
  readonly box: Box;
}

/**
 * The open session: the text, whether it is new, and the transaction that holds its changes since
 * the session started, whose net change compares them with its starting content.
 */
export interface TextSession {
  readonly id: ElementId;
  readonly isNew: boolean;
  readonly transaction: Transaction;
}

/** The text of the open session, or null when none is open. */
function editedText(core: EditorCore): TextElement | null {
  const element = core.session === null ? undefined : core.scene.get(core.session.id);
  return element?.kind === 'text' ? element : null;
}

/**
 * Starts editing a text, with nothing selected and the text hidden from the scene layer: a new
 * text in the gesture's open transaction, which added it, and an existing one in its own.
 */
export function startSession(core: EditorCore, id: ElementId): void {
  const isNew = core.transaction !== null;
  const transaction = core.transaction ?? core.history.begin();
  core.transaction = null;
  core.session = { id, isNew, transaction };
  core.selection.set([]);
  core.loop.update({ hidden: [id] });
}

/**
 * Shows a value of the text area: its line breaks as `\n`, measured again through the text
 * measurer, the text keeping its top-left corner. A value past the document's limits is left out.
 */
export function editSession(core: EditorCore, value: string): void {
  const element = editedText(core);
  const text = value.replace(/\r\n?/gu, '\n');
  if (core.session === null || element === null || text.length > LIMITS.text) return;
  const content = { ...element.content, text };
  const { width, height } = layoutText(content, core.measurer);
  if (width > LIMITS.size || height > LIMITS.size) return;
  const changes = updatesTo(core.scene, [{ ...element, content, width, height }]);
  core.session.transaction.preview({ elements: changes, groups: [], ...core.stamp() });
}

/**
 * Ends the open session, if any, and says whether one was open. A new text left empty is removed
 * without an undo step; an existing text emptied is deleted as one step; any other session is one
 * step, after which the text alone is selected, unless it is new and tool lock is on.
 */
export function endSession(core: EditorCore): boolean {
  const { session } = core;
  if (session === null) return false;
  const element = editedText(core);
  core.session = null;
  core.loop.update({ hidden: [] });
  if (element === null || (session.isNew && element.content.text === '')) {
    session.transaction.cancel();
  } else if (element.content.text === '') {
    session.transaction.preview({ ...deletionOf(core.scene, [element.id]), ...core.stamp() });
    commitWith(core, session.transaction, { label: 'delete', select: [] });
  } else {
    const select = session.isNew && core.toolLock ? [] : [element.id];
    commitWith(core, session.transaction, {
      label: session.isNew ? 'create' : 'edit-text',
      select,
    });
  }
  return true;
}

/** The session as the view shows it, its box on screen through the current camera. */
export function textView(core: EditorCore): TextEditView | null {
  const element = editedText(core);
  if (element === null) return null;
  const { zoom } = core.loop.state().camera;
  const at = screenFromScene(element, core.loop.state().camera);
  return {
    element,
    box: { ...at, width: element.width * zoom, height: element.height * zoom },
  };
}

/**
 * Ends the open session, if any, without keeping what it changed: its transaction is cancelled,
 * so a new text disappears and an edited one is back as it was. Loading another version does it.
 */
export function discardSession(core: EditorCore): void {
  const { session } = core;
  if (session === null) return;
  core.session = null;
  core.loop.update({ hidden: [] });
  session.transaction.cancel();
}
