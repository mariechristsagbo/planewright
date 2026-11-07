import type { Element } from '../model/elements.ts';
import { jsonEqual } from '../model/json-equal.ts';
import { UNPATCHED_FIELDS, patchValue } from '../model/patch.ts';
import type { ElementChange } from '../scene/change-set.ts';
import type { SceneReader } from '../scene/store.ts';

// The updates that take the scene to a transform's result
// (docs/architecture/engine/interaction.md#transforms): a transform computes whole elements from
// the values its gesture started with, and the scene is changed only where a field differs.

const PATCHED = (key: string): boolean => !(UNPATCHED_FIELDS as readonly string[]).includes(key);

/** The update from one version of an element to another, or null when no field differs. */
export function updateTo(current: Element, next: Element): ElementChange | null {
  const keys = [...new Set([...Object.keys(current), ...Object.keys(next)])].filter(
    (key) => PATCHED(key) && !jsonEqual(patchValue(current, key), patchValue(next, key)),
  );
  if (keys.length === 0) return null;
  const values = (element: Element) =>
    Object.fromEntries(keys.map((key) => [key, patchValue(element, key)]));
  return { type: 'update', id: current.id, before: values(current), after: values(next) };
}

/** The updates from the scene's versions of elements to these; one the scene lacks is skipped. */
export function updatesTo(scene: SceneReader, targets: readonly Element[]): ElementChange[] {
  return targets.flatMap((target) => {
    const current = scene.get(target.id);
    const change = current === undefined ? null : updateTo(current, target);
    return change === null ? [] : [change];
  });
}
