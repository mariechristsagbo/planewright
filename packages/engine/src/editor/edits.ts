import type { EditOptions } from '../commands/registry.ts';
import type { HistoryLabel } from '../history/entry.ts';
import type { Transaction } from '../history/transaction.ts';
import type { ElementId } from '../model/ids.ts';
import { isEmptyChangeSet } from '../scene/change-set.ts';
import type { UnstampedChangeSet } from '../scene/change-set.ts';
import type { ToolEffect } from '../tools/tool.ts';
import type { EditorCore } from './editor-core.ts';

// How commands and gestures change the document (docs/architecture/engine/history.md#transactions):
// each through one transaction, so one undo step.

/**
 * A command's change: one transaction, so one undo step, with the selection after it. The
 * selection is set before the commit, which records it for redo, and again after it, because the
 * commit's transient revert drops elements that the preview added from the selection (the ENG-06
 * review's m2, open until the selection layer keeps them).
 */
export function edit(
  core: EditorCore,
  label: HistoryLabel,
  changes: UnstampedChangeSet,
  options: EditOptions = {},
): void {
  const transaction = core.history.begin();
  try {
    transaction.preview({ ...changes, ...core.stamp() });
    if (options.select !== undefined) core.selection.set(options.select);
  } catch (error) {
    transaction.cancel();
    throw error;
  }
  transaction.commit(label, options.mergeKey === undefined ? {} : { mergeKey: options.mergeKey });
  if (options.select !== undefined) core.selection.set(options.select);
}

/**
 * Commits a transaction with the selection after it, set before the commit, which records it for
 * redo, and again after it, because the commit's transient revert drops the elements that its
 * previews added from the selection (the ENG-06 review's m2), as `edit` does for commands.
 */
export function commitWith(
  core: EditorCore,
  transaction: Transaction,
  effect: { readonly label: HistoryLabel; readonly select?: readonly ElementId[] },
): void {
  if (effect.select !== undefined) core.selection.set(effect.select);
  transaction.commit(effect.label);
  if (effect.select !== undefined) core.selection.set(effect.select);
}

export type EditEffect = Extract<ToolEffect, { readonly type: 'preview' | 'commit' | 'cancel' }>;

/**
 * A gesture's preview: the first one opens its transaction. A preview that the scene store refuses
 * cancels the transaction before its error goes on, so the history is never left locked (the
 * ENG-11 review's m1).
 */
function preview(core: EditorCore, { changes }: Extract<EditEffect, { readonly type: 'preview' }>) {
  const transaction = (core.transaction ??= core.history.begin());
  if (isEmptyChangeSet(changes)) return;
  try {
    transaction.preview({ ...changes, ...core.stamp() });
  } catch (error) {
    core.transaction = null;
    transaction.cancel();
    throw error;
  }
}

/**
 * A gesture's document changes: its first preview opens its transaction, so undo and redo are
 * ignored until it closes (REQ-H06); its commit records one undo step and its cancel reverts it.
 */
export function applyEdit(core: EditorCore, effect: EditEffect): void {
  if (effect.type === 'preview') {
    preview(core, effect);
    return;
  }
  const { transaction } = core;
  core.transaction = null;
  if (transaction === null) return;
  if (effect.type === 'commit') commitWith(core, transaction, effect);
  else transaction.cancel();
}
