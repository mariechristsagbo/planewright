import type { Element, Point } from '../model/elements.ts';
import { updatesTo } from '../transform/changes.ts';
import { deletionOf } from '../transform/delete.ts';
import { duplicatesOf } from '../transform/duplicate.ts';
import { moveBy } from '../transform/move.ts';
import type { Command, CommandTarget, NudgeDirection } from './registry.ts';

// Duplicate, Delete and the nudges (docs/architecture/engine/interaction.md#commands-and-shortcuts):
// each changes the selection in one transaction, so it is one undo step (REQ-T11).

/** There is a selection to change, and no gesture's transaction is open. */
const editable = (target: CommandTarget): boolean =>
  target.selection.length > 0 && !target.history.inTransaction;

const selectedIn = ({ scene, selection }: CommandTarget): Element[] =>
  selection.map((id) => scene.get(id)).filter((element) => element !== undefined);

const DIRECTIONS: readonly (readonly [NudgeDirection, string, Point])[] = [
  ['left', 'arrowleft', { x: -1, y: 0 }],
  ['right', 'arrowright', { x: 1, y: 0 }],
  ['up', 'arrowup', { x: 0, y: -1 }],
  ['down', 'arrowdown', { x: 0, y: 1 }],
];

/**
 * An arrow key moves the selection by 1 unit, or by 10 with Shift (REQ-T10). The merge key names
 * the key press, so that a held key's repeats merge into one undo step and the next press is
 * another.
 */
function nudge([direction, key, unit]: (typeof DIRECTIONS)[number], far: boolean): Command {
  const step = far ? 10 : 1;
  return {
    id: far ? `selection.nudge-${direction}-10` : `selection.nudge-${direction}`,
    label: far ? `Nudge ${direction} by 10` : `Nudge ${direction}`,
    shortcuts: [far ? { key, shift: true } : { key }],
    isEnabled: editable,
    run: (target) => {
      const moved = moveBy(selectedIn(target), { x: unit.x * step, y: unit.y * step });
      target.edit(
        'nudge',
        { elements: updatesTo(target.scene, moved), groups: [] },
        { mergeKey: `nudge ${String(target.keyPress)}` },
      );
    },
  };
}

export const EDIT_COMMANDS: readonly Command[] = [
  {
    id: 'selection.duplicate',
    label: 'Duplicate',
    shortcuts: [{ key: 'd', mod: true }],
    isEnabled: editable,
    run: (target) => {
      const copies = duplicatesOf(target.scene, target.selection, target.newId);
      const elements = copies.map((element) => ({ type: 'add', element }) as const);
      target.edit('duplicate', { elements, groups: [] }, { select: copies.map(({ id }) => id) });
    },
  },
  {
    id: 'selection.delete',
    label: 'Delete',
    shortcuts: [{ key: 'delete' }, { key: 'backspace' }],
    isEnabled: editable,
    run: (target) => {
      target.edit('delete', deletionOf(target.scene, target.selection));
    },
  },
  ...DIRECTIONS.flatMap((direction) => [nudge(direction, false), nudge(direction, true)]),
];
