import type { Color } from '../../src/model/color.ts';
import type { DocumentState } from '../../src/model/document.ts';
import type { ClientId } from '../../src/model/ids.ts';
import { createAttachmentIndex } from '../../src/scene/attachment-index.ts';
import type {
  CanvasChange,
  ChangeSet,
  ElementChange,
  GroupChange,
} from '../../src/scene/change-set.ts';
import type { SceneState } from '../../src/scene/check.ts';
import { createGroupIndex } from '../../src/scene/group-index.ts';

/** The state that a change set is checked against, with its indexes built from a document. */
export function stateOf(document: DocumentState): SceneState {
  const groups = createGroupIndex();
  const attachments = createAttachmentIndex();
  const deltas = [...document.elements.values()].map((after) => ({
    id: after.id,
    before: undefined,
    after,
  }));
  groups.addGroups([...document.groups.values()]);
  groups.update(deltas);
  attachments.update(deltas);
  return { elements: document.elements, groups, attachments, canvas: document.canvas };
}

export const AUTHOR = 'A'.repeat(22) as ClientId;

/** A change set by the test's author. */
export const changeSet = (
  elements: readonly ElementChange[],
  groups: readonly GroupChange[] = [],
  canvas?: CanvasChange,
): ChangeSet => ({
  elements,
  groups,
  ...(canvas === undefined ? {} : { canvas }),
  author: AUTHOR,
  seq: 1,
});

export const color = (text: string): Color => text as Color;

/** A document without its revisions, which only grow: what "equal to its start" compares. */
export const contentOf = ({ elements, groups, canvas }: DocumentState) => ({
  elements: [...elements.values()]
    .map((element) => ({ ...element, rev: 0 }))
    .sort((a, b) => (a.id < b.id ? -1 : 1)),
  groups: [...groups.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
  canvas,
});
