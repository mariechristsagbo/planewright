import { checkElement } from './element-checks.ts';
import type { Element } from './elements.ts';
import { INVALID, fieldPath } from './json-check.ts';
import type { Invalid, Issues } from './json-check.ts';
import { jsonEqual } from './json-equal.ts';

/**
 * Some fields of an element, without `id`, `kind` and `rev`
 * (docs/architecture/engine/scene-and-viewport.md#change-sets). No element field holds `null` at
 * the top level, so `null` says that an optional field is absent, and a patch survives a JSON
 * round trip where `undefined` would vanish. A nested value such as `style` is replaced whole.
 */
export type ElementPatch = Readonly<Record<string, unknown>>;

/** The fields that no patch holds: what an element is, and the revision the scene keeps. */
export const UNPATCHED_FIELDS = ['id', 'kind', 'rev'] as const;

const fields = (element: Element): Readonly<Record<string, unknown>> =>
  element as unknown as Readonly<Record<string, unknown>>;

/** What a patch writes for an element's field: its value, or null when the element lacks it. */
export const patchValue = (element: Element, key: string): unknown =>
  Object.hasOwn(element, key) ? fields(element)[key] : null;

/** Whether each field of the patch holds the element's current value, null meaning absent. */
export const matchesPatch = (element: Element, patch: ElementPatch): boolean =>
  Object.entries(patch).every(([key, value]) => jsonEqual(patchValue(element, key), value));

/**
 * The element's fields with the patch applied, unchecked: each field of the patch set to its
 * value, or removed where the patch holds null. An own `__proto__` field stays data.
 */
export function applyPatch(element: Element, patch: ElementPatch): Record<string, unknown> {
  const kept = Object.entries(element).filter(([key]) => !Object.hasOwn(patch, key));
  const written = Object.entries(patch).filter(([, value]) => value !== null);
  return Object.fromEntries([...kept, ...written]);
}

/**
 * The element that a patch makes, checked per kind by the codec's own element check, so the scene
 * never holds what a document could not; or {@link INVALID} once the errors are reported at
 * `path`. Whether a group or an attachment's target exists is the scene's check.
 */
export function patchElement(
  element: Element,
  patch: ElementPatch,
  path: string,
  issues: Issues,
): Element | Invalid {
  const held = UNPATCHED_FIELDS.filter((key) => Object.hasOwn(patch, key));
  for (const key of held) {
    issues.push({ path: fieldPath(path, key), problem: 'unknown-field' });
  }
  return held.length > 0 ? INVALID : checkElement(applyPatch(element, patch), path, issues);
}
