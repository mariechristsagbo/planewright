import type { CanvasState, DocumentState, GroupRecord } from '../model/document.ts';
import type { Box, Element, Point } from '../model/elements.ts';
import type { ElementId, GroupId } from '../model/ids.ts';
import type { Cancel } from '../ports/ports.ts';
import { createAttachmentIndex } from './attachment-index.ts';
import type { AttachmentIndex } from './attachment-index.ts';
import type { ChangeOrigin, ChangeSet } from './change-set.ts';
import { planChangeSet } from './check.ts';
import type { ChangeError, Plan, Planned } from './check.ts';
import { createGroupIndex } from './group-index.ts';
import type { GroupIndex } from './group-index.ts';
import { rethrowFirst } from './listener-errors.ts';
import { createOrderIndex } from './order-index.ts';
import type { OrderIndex } from './order-index.ts';
import { createSpatialIndex } from './spatial-index.ts';
import type { SpatialIndex } from './spatial-index.ts';

// The scene store (docs/architecture/engine/scene-and-viewport.md#store-interface): the only
// holder of the document, changed only by applying change sets.

/** What one applied change set did, sent to every listener. */
export interface SceneUpdate {
  readonly origin: ChangeOrigin;
  /** A preview: drawn and hit-tested, but never recorded or saved. */
  readonly transient: boolean;
  readonly changes: ChangeSet;
  /** The elements added, removed or updated, in the order of the set's changes. */
  readonly changed: readonly ElementId[];
  /** The document's revision after the set. */
  readonly rev: number;
}

export interface SceneReader {
  /** Raised by every applied change set, previews included. */
  readonly rev: number;
  readonly canvas: CanvasState;
  get(id: ElementId): Element | undefined;
  group(id: GroupId): GroupRecord | undefined;
  /** Elements in drawing order, bottom first. */
  ordered(): readonly Element[];
  /** The elements whose world bounds meet a box; precise tests are the caller's. */
  queryBox(box: Box): readonly ElementId[];
  /** The elements whose world bounds are within `radius` of a point. */
  queryPoint(point: Point, radius: number): readonly ElementId[];
  outermostGroup(id: ElementId): GroupId | undefined;
  /** The elements in a group or in any group nested in it. */
  members(group: GroupId): readonly ElementId[];
  connectorsOf(target: ElementId): readonly ElementId[];
  /** A copy of the document as it is now. */
  document(): DocumentState;
}

export interface ApplyOptions {
  /** Apply as a preview: the indexes follow it, but nothing records or saves it. */
  readonly transient: boolean;
}

export interface SceneStore extends SceneReader {
  /**
   * Applies the whole set, or throws a {@link ChangeSetError} and changes nothing. Once the set is
   * applied every listener is told, and the first error a listener threw is then rethrown. While
   * the store plans a set or tells its listeners of one, it throws instead of applying another.
   */
  apply(changes: ChangeSet, origin: ChangeOrigin, options?: ApplyOptions): void;
  subscribe(listener: (update: SceneUpdate) => void): Cancel;
}

/** A refused change set, with every reason and where in the set it lies. */
export class ChangeSetError extends Error {
  readonly errors: readonly ChangeError[];

  constructor(errors: readonly ChangeError[]) {
    const reasons = errors.map(({ path, problem }) => `${path} ${problem}`).join(', ');
    super(`The change set was refused: ${reasons}.`);
    this.name = 'ChangeSetError';
    this.errors = errors;
  }
}

/** The document, its indexes and the listeners; only {@link apply} changes them. */
interface Scene {
  readonly elements: Map<ElementId, Element>;
  readonly groups: GroupIndex;
  readonly attachments: AttachmentIndex;
  readonly order: OrderIndex;
  readonly spatial: SpatialIndex;
  readonly listeners: Set<{ readonly listener: (update: SceneUpdate) => void }>;
  canvas: CanvasState;
  rev: number;
  /** The drawing order's elements, until the next set. */
  ordered: readonly Element[] | undefined;
  /** Whether listeners are being told of a set. */
  notifying: boolean;
  /** Whether a set is being planned, during which reading one of its values may run code. */
  planning: boolean;
}

/** Step 2: the checked plan is applied, and the indexes follow the changed elements only. */
function commit(scene: Scene, plan: Plan): void {
  scene.groups.addGroups(plan.addedGroups);
  for (const { id, after } of plan.elements) {
    if (after === undefined) scene.elements.delete(id);
    else scene.elements.set(id, after);
  }
  for (const index of [scene.order, scene.spatial, scene.groups, scene.attachments]) {
    index.update(plan.elements);
  }
  scene.groups.removeGroups(plan.removedGroups);
  scene.canvas = plan.canvas ?? scene.canvas;
  scene.rev += 1;
  scene.ordered = undefined;
}

/**
 * Step 3: one update goes to every listener in turn. A listener that throws cannot keep the update
 * from the others: the first error is rethrown once all of them are told, with the set applied.
 */
function notify(scene: Scene, update: SceneUpdate): void {
  const failures: unknown[] = [];
  scene.notifying = true;
  for (const { listener } of [...scene.listeners]) {
    try {
      listener(update);
    } catch (error) {
      failures.push(error);
    }
  }
  scene.notifying = false;
  rethrowFirst(failures);
}

/**
 * Step 1, during which the store applies no other set. A change set holds JSON values only, but a
 * value that runs code when the check reads it could otherwise apply a set to the store, which the
 * plan would not see; the flag is lowered however planning ends, even by a throw.
 */
function plan(scene: Scene, changes: ChangeSet, origin: ChangeOrigin): Planned {
  scene.planning = true;
  try {
    return planChangeSet(scene, changes, origin);
  } finally {
    scene.planning = false;
  }
}

function apply(
  scene: Scene,
  changes: ChangeSet,
  origin: ChangeOrigin,
  options?: ApplyOptions,
): void {
  if (scene.notifying) {
    throw new Error('A scene update listener cannot apply a change set while it is notified.');
  }
  if (scene.planning) {
    throw new Error('The scene store cannot apply a change set while it is planning one.');
  }
  const planned = plan(scene, changes, origin);
  if (!planned.ok) {
    throw new ChangeSetError(planned.errors);
  }
  commit(scene, planned.plan);
  const changed = planned.plan.elements.map(({ id }) => id);
  notify(scene, {
    origin,
    transient: options?.transient ?? false,
    changes,
    changed,
    rev: scene.rev,
  });
}

const orderedOf = (scene: Scene): readonly Element[] =>
  (scene.ordered ??= scene.order
    .ids()
    .map((id) => scene.elements.get(id))
    .filter((element) => element !== undefined));

const documentOf = (scene: Scene): DocumentState => ({
  elements: new Map(scene.elements),
  groups: new Map(scene.groups.groups),
  canvas: scene.canvas,
  rev: scene.rev,
});

/**
 * A scene store that starts empty, at revision 0, with the given canvas; a document is loaded by
 * applying it as a `load` change set. Applying is atomic: the set is checked whole first, then
 * applied, then one {@link SceneUpdate} goes to each listener in turn, even after one throws. A
 * listener may not apply a change set of its own while it is told of one, since every set is
 * complete before it is applied, and nothing may apply one while the store plans a set.
 */
export function createSceneStore(canvas: CanvasState): SceneStore {
  const scene: Scene = {
    elements: new Map(),
    groups: createGroupIndex(),
    attachments: createAttachmentIndex(),
    order: createOrderIndex(),
    spatial: createSpatialIndex(),
    listeners: new Set(),
    canvas,
    rev: 0,
    ordered: undefined,
    notifying: false,
    planning: false,
  };
  return {
    get rev() {
      return scene.rev;
    },
    get canvas() {
      return scene.canvas;
    },
    get: (id) => scene.elements.get(id),
    group: (id) => scene.groups.groups.get(id),
    ordered: () => orderedOf(scene),
    queryBox: (box) => scene.spatial.queryBox(box),
    queryPoint: (point, radius) => scene.spatial.queryPoint(point, radius),
    outermostGroup: (id) => scene.groups.outermostGroup(id),
    members: (group) => scene.groups.members(group),
    connectorsOf: (target) => scene.attachments.connectorsOf(target),
    document: () => documentOf(scene),
    apply: (changes, origin, options) => {
      apply(scene, changes, origin, options);
    },
    subscribe(listener) {
      const entry = { listener };
      scene.listeners.add(entry);
      return () => {
        scene.listeners.delete(entry);
      };
    },
  };
}
