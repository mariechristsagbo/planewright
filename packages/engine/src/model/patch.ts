import { FIELD_CHECKS, checkAcrossFields, checkElement } from './element-checks.ts';
import type { Element } from './elements.ts';
import { revision } from './field-checks.ts';
import { INVALID, fieldPath, isRecord } from './json-check.ts';
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
export function matchesPatch(element: Element, patch: ElementPatch): boolean {
  for (const key of Object.keys(patch)) {
    if (!jsonEqual(patchValue(element, key), patch[key])) return false;
  }
  return true;
}

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

const UNPATCHED: ReadonlySet<string> = new Set(UNPATCHED_FIELDS);

/** The checks of the fields that a patch may write, for each kind: all but {@link UNPATCHED_FIELDS}. */
const PATCH_CHECKS = new Map(
  Object.entries(FIELD_CHECKS).map(([kind, checks]) => [
    kind,
    new Map([...checks].filter(([key]) => !UNPATCHED.has(key))),
  ]),
);

/** The value that a patch writes into a field the element holds, checked as the field's own; or INVALID. */
function heldValue(element: Element, key: string, value: unknown, issues: Issues): unknown {
  const check = PATCH_CHECKS.get(element.kind)?.get(key);
  if (check === undefined || !Object.hasOwn(element, key) || value === null) {
    return INVALID;
  }
  return check(value, key, issues);
}

/**
 * The element's next version, its revision one higher, when the patch writes only fields that the
 * element holds; otherwise undefined, which leaves the patch to {@link patchElement}. Each value
 * written passes its field's own check, which copies it, and the element the kind's checks across
 * its fields; it is then the element that `patchElement` makes, field order included. The fields
 * that it leaves were checked when the scene took the element and are shared with it, all but the
 * revision, which the scene raises unchecked and which is checked again, as the whole check does.
 * The checks report into a list of the call's own, which it only counts: no other call, even one
 * made while a value of the patch is read, can clear or fill it.
 */
export function patchHeldFields(element: Element, patch: ElementPatch): Element | undefined {
  const issues: Issues = [];
  if (!isRecord(patch) || revision(element.rev, 'rev', issues) === INVALID) {
    return undefined;
  }
  const next: Record<string, unknown> = { ...element };
  for (const key of Object.keys(patch)) {
    const value = heldValue(element, key, patch[key], issues);
    if (value === INVALID) return undefined;
    next[key] = value;
  }
  // Every field of the kind is there and valid, so the object has the shape of an element.
  const patched = next as unknown as Element;
  checkAcrossFields(patched, '', issues);
  if (issues.length > 0) return undefined;
  next['rev'] = element.rev + 1;
  return patched;
}
