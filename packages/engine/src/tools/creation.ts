import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';
import { updatesTo } from '../transform/changes.ts';
import type { CreatedElement } from './new-elements.ts';
import type { ToolContext, ToolEffect } from './tool.ts';

// What every creation tool asks of the editor (docs/architecture/engine/interaction.md#p0-tools):
// one transaction per creation, whose first preview adds the element, and one undo step.

/** A creation first clears the selection, so that undoing it leaves nothing selected (REQ-C13). */
export const CLEAR_SELECTION: ToolEffect = { type: 'select', ids: [] };

/**
 * The preview that shows a new element: its addition, which opens the gesture's transaction, or,
 * once it is shown, the updates of the fields that changed since.
 */
export function showing(element: CreatedElement, shown: boolean, scene: SceneReader): ToolEffect {
  const elements = shown ? updatesTo(scene, [element]) : [{ type: 'add', element } as const];
  return { type: 'preview', changes: { elements, groups: [] } };
}

/**
 * The end of a creation: one undo step labelled `create` (REQ-C13). Then the editor selects the
 * new element alone and switches to the Selection tool, unless tool lock is on or the tool stays
 * active, as the freehand tool does, and nothing new is selected (REQ-C05, REQ-C06).
 */
export function created(id: ElementId, context: ToolContext, staysActive: boolean): ToolEffect[] {
  if (staysActive || context.toolLock) return [{ type: 'commit', label: 'create' }];
  return [
    { type: 'commit', label: 'create', select: [id] },
    { type: 'set-tool', tool: 'selection' },
  ];
}
