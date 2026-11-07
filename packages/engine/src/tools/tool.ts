import type { Camera } from '../camera/camera.ts';
import type { Modifiers } from '../input/events.ts';
import type { Point } from '../model/elements.ts';
import type { PointerKind } from '../selection/pointer.ts';

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
  | { readonly type: 'cursor'; readonly cursor: CursorKind };

/** What a tool may read; more joins with the tools that need it. */
export interface ToolContext {
  readonly camera: Camera;
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
