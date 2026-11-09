import { isCreationTool } from '../tools/active.ts';
import type { Command, CommandTarget } from './registry.ts';

// Enter on the canvas (docs/architecture/engine/quality.md#accessibility): with a creation tool it
// creates the tool's default element at the centre of the viewport, and with the Selection tool it
// edits a lone selected text, so that no element kind needs a pointer (REQ-C04, REQ-Y05).

/** The selected element, if the Selection tool is active and it is a text selected alone. */
function loneText({ tool, selection, scene }: CommandTarget) {
  const [id] = selection;
  if (tool !== 'selection' || selection.length !== 1 || id === undefined) return undefined;
  return scene.get(id)?.kind === 'text' ? id : undefined;
}

export const ENTER_COMMAND: Command = {
  id: 'canvas.enter',
  label: 'Create at the centre, or edit the selected text',
  shortcuts: [{ key: 'enter' }],
  // Not while a gesture or a text session holds the history's transaction.
  isEnabled: (target) =>
    !target.history.inTransaction &&
    (isCreationTool(target.tool) || loneText(target) !== undefined),
  run: (target) => {
    const text = loneText(target);
    if (text !== undefined) {
      target.editText(text);
      return;
    }
    // A press that has not become a drag yet is let go first, so the tool starts from idle.
    target.cancelGesture();
    target.tapCentre();
  },
};
