import type { Color } from './color.ts';
import type { Element } from './elements.ts';
import type { ElementId, GroupId } from './ids.ts';

/** A group; parents make groups a forest, and each element names its innermost group. */
export interface GroupRecord {
  readonly id: GroupId;
  readonly parent?: GroupId;
}

export interface CanvasState {
  readonly background: Color;
}

/**
 * A drawing. Selection, camera, tool, theme and preferences are editor or session state, never
 * document state.
 */
export interface DocumentState {
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly groups: ReadonlyMap<GroupId, GroupRecord>;
  readonly canvas: CanvasState;
  /** In memory only: raised by every applied change set and never saved. */
  readonly rev: number;
}
