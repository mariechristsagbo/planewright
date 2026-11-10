import { describe, expect, it } from 'vitest';

import { createRandom } from '../../../src/math/random.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import { INVALID } from '../../../src/model/json-check.ts';
import type { Issues } from '../../../src/model/json-check.ts';
import { patchElement, patchHeldFields } from '../../../src/model/patch.ts';
import type { ElementPatch } from '../../../src/model/patch.ts';
import { elementId } from '../../support/fixtures.ts';
import { anyBrokenPatch, anyValidPatch } from '../../support/mixed-patches.ts';
import { anyMixedScene } from '../../support/mixed-sets.ts';
import { checkProperty } from '../../support/property.ts';
import { pick } from '../../support/scenes.ts';
import { deepFreeze } from '../../support/store-model.ts';

// The held-field path of an update (issue 36): a patch that writes only fields its element holds
// is checked field by field and across fields, and the element it makes is the one that the
// generic path, `patchElement`, makes, its revision one higher; anything else is left to it.

/** The fixture's elements, checked into the model's field order as the store holds them. */
const SCENE = anyMixedScene(createRandom(36), 0, false);

function held(index: number): Element {
  const element = SCENE.elements.get(elementId(index) as ElementId);
  if (element === undefined) throw new Error(`The scene has no element ${String(index)}.`);
  return element;
}

/** What the generic path makes of the patch, its revision raised as the scene raises it. */
function generic(element: Element, patch: ElementPatch): Element | undefined {
  const issues: Issues = [];
  const result = patchElement(element, patch, 'after', issues);
  return result === INVALID ? undefined : { ...result, rev: element.rev + 1 };
}

const block = { text: 'b', font: { family: 'hand', size: 30, lineHeight: 1 }, align: 'left' };

describe('patchHeldFields', () => {
  it('writes the fields, raises the revision by one and keeps the element’s field order', () => {
    const rectangle = held(0);
    const next = patchHeldFields(rectangle, { y: 7, x: -0, label: block });
    expect(next).toStrictEqual({ ...rectangle, x: -0, y: 7, label: block, rev: rectangle.rev + 1 });
    expect(Object.keys(next ?? {})).toStrictEqual(Object.keys(rectangle));
    expect(patchHeldFields(rectangle, {})).toStrictEqual({ ...rectangle, rev: rectangle.rev + 1 });
  });

  it('shares the fields that it leaves, and copies every value that it writes', () => {
    const freehand = held(4);
    const style = { ...freehand.style, opacity: 0.5 };
    const next = patchHeldFields(freehand, { style });
    if (next?.kind !== 'freehand' || freehand.kind !== 'freehand') throw new Error('A freehand.');
    expect(next.points).toBe(freehand.points);
    expect(next.pressures).toBe(freehand.pressures);
    expect(next.style).toStrictEqual(style);
    expect(next.style).not.toBe(style);
    expect(next.style.stroke).not.toBe(style.stroke);
  });

  it('changes neither the element nor the patch', () => {
    const arrow = deepFreeze({ ...held(6) });
    const patch = deepFreeze({
      x: 1,
      label: block,
      end: { target: elementId(2), anchor: { x: 1, y: 1 } },
    });
    expect(patchHeldFields(arrow, patch)).toMatchObject({ x: 1, rev: arrow.rev + 1 });
  });

  it.each([
    ['a field of another kind', 3, { width: 4 }],
    ['a field that the element lacks', 2, { link: 'https://a.test/' }],
    ['an identifier', 0, { id: elementId(1) }],
    ['a kind', 0, { kind: 'ellipse' }],
    ['a revision', 0, { rev: 5 }],
    ['an optional field removed', 0, { link: null }],
    ['a required field removed', 0, { x: null }],
    ['undefined', 0, { x: undefined }],
    ['a value that its check refuses', 0, { x: Number.NaN, y: 1 }],
    ['a value with a field too many', 3, { style: { ...held(3).style, extra: 1 } }],
    ['pressures that no longer match the points', 4, { points: [{ x: 0, y: 0 }] }],
    ['a line cut to one point', 3, { points: [{ x: 0, y: 0 }] }],
    ['an arrow attached to itself', 6, { start: { target: elementId(6), anchor: { x: 0, y: 0 } } }],
    ['an own __proto__ field', 0, JSON.parse('{"__proto__":{"x":1}}') as ElementPatch],
    ['an array', 0, [] as unknown as ElementPatch],
    ['a string', 0, 'ab' as unknown as ElementPatch],
    ['null', 0, null as unknown as ElementPatch],
  ])('leaves %s to the generic path', (_, index, patch) => {
    expect(patchHeldFields(held(index), patch)).toBeUndefined();
  });

  it('leaves an element whose revision is out of range to the generic path, which refuses it', () => {
    const raised = { ...held(2), rev: 2 ** 53 };
    expect(patchHeldFields(raised, { x: 1 })).toBeUndefined();
    expect(generic(raised, { x: 1 })).toBeUndefined();
  });

  it('makes what the generic path makes, and plans every patch of held fields that it accepts', () => {
    const elements = [...anyMixedScene(createRandom(3664), 60, false).elements.values()];
    checkProperty(
      { seed: 3664, runs: 600 },
      (random) => {
        const element = pick(random, elements);
        const patch =
          random.next() < 0.7 ? anyValidPatch(random, element) : anyBrokenPatch(random, element);
        return { element, patch };
      },
      ({ element, patch }) => {
        const next = patchHeldFields(element, patch);
        const expected = generic(element, patch);
        if (next !== undefined) {
          expect(next).toStrictEqual(expected);
          expect(JSON.stringify(next)).toBe(JSON.stringify(expected));
        }
        const heldOnly = Object.entries(patch).every(
          ([key, value]) => value !== null && Object.hasOwn(element, key),
        );
        if (heldOnly && expected !== undefined) expect(next).toBeDefined();
      },
    );
  });
});
