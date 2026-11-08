import type { Camera } from '../camera/camera.ts';
import type { TextMeasurer } from '../geometry/text-measurer.ts';
import type { HistoryLabel } from '../history/entry.ts';
import type { Modifiers } from '../input/events.ts';
import type { Box, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { Style } from '../model/style.ts';
import type { UnstampedChangeSet } from '../scene/change-set.ts';
import type { SceneReader } from '../scene/store.ts';
import type { HitResult } from '../selection/hit-test.ts';
import type { PointerKind } from '../selection/pointer.ts';
import type { SelectionState } from '../selection/selection.ts';

// Tools (docs/architecture/engine/interaction.md#tools): each tool is a reducer over its own state
// that returns effects for the editor to apply, so a tool never changes anything itself.

/** The tools that create elements. */
export type CreationToolId = 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'freehand' | 'text';

export type ToolId = 'selection' | 'hand' | CreationToolId;

export type CursorKind = 'default' | 'grab' | 'grabbing' | 'crosshair' | 'text';

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

/**
 * What a tool asks of the editor. A gesture that changes the document previews its changes, which
 * open its transaction, and then commits them as one undo step or cancels them.
 */
export type ToolEffect =
  /** Pans the camera by a screen delta, so the content follows the pointer. */
  | { readonly type: 'pan'; readonly delta: Point }
  | { readonly type: 'cursor'; readonly cursor: CursorKind }
  /** Replaces the selection; never an undo step (REQ-S13). */
  | { readonly type: 'select'; readonly ids: readonly ElementId[] }
  /** Shows the box selection's marquee in scene units, or hides it with null. */
  | { readonly type: 'marquee'; readonly box: Box | null }
  /** Applies a transient change set in the gesture's transaction, which the first one opens. */
  | { readonly type: 'preview'; readonly changes: UnstampedChangeSet }
  /**
   * Commits the gesture's transaction as one undo step (REQ-T11), with `select` as the selection
   * after it, which redo restores.
   */
  | {
      readonly type: 'commit';
      readonly label: HistoryLabel;
      readonly select?: readonly ElementId[];
    }
  /** Reverts the gesture's previews and closes its transaction without an undo step. */
  | { readonly type: 'cancel' }
  /** Makes another tool active once the gesture has ended, as a creation does (REQ-C05). */
  | { readonly type: 'set-tool'; readonly tool: ToolId }
  /**
   * Starts editing a text: a new one in the gesture's open transaction, which its preview added,
   * or an existing one in a transaction of its own (REQ-C10).
   */
  | { readonly type: 'edit-text'; readonly id: ElementId };

/** What a tool may read. */
export interface ToolContext {
  readonly camera: Camera;
  readonly scene: SceneReader;
  readonly selection: SelectionState;
  /** What a press at a screen point hits: a handle, an element, the selection box or nothing. */
  readonly hit: (at: Point, pointer: PointerKind) => HitResult;
  /** The editor's current default style, which new elements take (REQ-C12). */
  readonly defaults: Style;
  /** Whether a creation tool stays active after a creation (REQ-C05). */
  readonly toolLock: boolean;
  /** A new element identifier from the identifier source. */
  readonly newId: () => ElementId;
  /** Measures texts in their fonts, through the editor's text measurer port. */
  readonly measurer: TextMeasurer;
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
