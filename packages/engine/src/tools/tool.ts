import type { Camera } from '../camera/camera.ts';
import type { Modifiers } from '../input/events.ts';
import type { Box, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';
import type { HitResult } from '../selection/hit-test.ts';
import type { PointerKind } from '../selection/pointer.ts';
import type { SelectionState } from '../selection/selection.ts';

// Tools (docs/architecture/engine/interaction.md#tools): each tool is a reducer over its own state
// that returns effects for the editor to apply, so a tool never changes anything itself.

/** The tools so far; the creation tools join with their issues. */
export type ToolId = 'selection' | 'hand';

export type CursorKind = 'default' | 'grab' | 'grabbing';

/** A gesture as a tool sees it: the recogniser's, with the scene point under the pointer. */
export type GestureEvent =
  | {
      readonly type: 'press' | 'drag-start' | 'drag' | 'release';
      readonly at: Point;
      readonly scene: Point;
      readonly pointer: PointerKind;
      readonly modifiers: Modifiers;
      readonly pressure?: number;
    }
  | {
      readonly type: 'tap' | 'double-tap';
      readonly at: Point;
      readonly scene: Point;
      readonly pointer: PointerKind;
      readonly modifiers: Modifiers;
    }
  | { readonly type: 'cancel' };

/** What a tool asks of the editor; the document-changing effects join with the tools that need them. */
export type ToolEffect =
  /** Pans the camera by a screen delta, so the content follows the pointer. */
  | { readonly type: 'pan'; readonly delta: Point }
  | { readonly type: 'cursor'; readonly cursor: CursorKind }
  /** Replaces the selection; never an undo step (REQ-S13). */
  | { readonly type: 'select'; readonly ids: readonly ElementId[] }
  /** Shows the box selection's marquee in scene units, or hides it with null. */
  | { readonly type: 'marquee'; readonly box: Box | null };

/** What a tool may read; the defaults, tool lock and new identifiers join with the creation tools. */
export interface ToolContext {
  readonly camera: Camera;
  readonly scene: SceneReader;
  readonly selection: SelectionState;
  /** What a press at a screen point hits: a handle, an element, the selection box or nothing. */
  readonly hit: (at: Point, pointer: PointerKind) => HitResult;
}

export interface ToolStep<State> {
  readonly state: State;
  readonly effects: readonly ToolEffect[];
}

export interface Tool<State> {
  readonly id: ToolId;
  readonly initial: State;
  /** The cursor over the canvas while the tool is idle. */
  readonly cursor: CursorKind;
  reduce(state: State, event: GestureEvent, context: ToolContext): ToolStep<State>;
}
