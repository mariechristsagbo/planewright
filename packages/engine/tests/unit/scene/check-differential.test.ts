import { describe, expect, it } from 'vitest';

import { createRandom, randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import { LIMITS } from '../../../src/model/limits.ts';
import { patchValue } from '../../../src/model/patch.ts';
import type { ElementPatch } from '../../../src/model/patch.ts';
import type { ChangeOrigin, ChangeSet, ElementChange } from '../../../src/scene/change-set.ts';
import { planChangeSet } from '../../../src/scene/check.ts';
import type { Planned, SceneState } from '../../../src/scene/check.ts';
import { elementId, groupId } from '../../support/fixtures.ts';
import { anyMixedScene, anyMixedSet } from '../../support/mixed-sets.ts';
import { checkProperty } from '../../support/property.ts';
import { referencePlan } from '../../support/reference-plan.ts';
import { changeSet, stateOf } from '../../support/scene-state.ts';
import { chance, sceneElementId } from '../../support/scenes.ts';

// The planner against the planner as it was before issue 36 (tests/support/reference-plan.ts):
// for every origin, the same plan, field order included, or the same errors in the same order, or
// the same thrown error, over mixed change sets of valid and refused changes.

const ORIGINS: readonly ChangeOrigin[] = ['local', 'history', 'load', 'remote'];

type Outcome = { readonly planned: Planned } | { readonly threw: string };

function attempt(plan: () => Planned): Outcome {
  try {
    return { planned: plan() };
  } catch (error) {
    return { threw: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

/** Both planners agree on the set for every origin; returns how many origins planned it. */
function expectSamePlans(state: SceneState, changes: ChangeSet): number {
  let planned = 0;
  for (const origin of ORIGINS) {
    const actual = attempt(() => planChangeSet(state, changes, origin));
    const expected = attempt(() => referencePlan(state, changes, origin));
    expect(actual).toStrictEqual(expected);
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    if ('planned' in actual && actual.planned.ok) planned += 1;
  }
  return planned;
}

/** The scene with its element of the largest revision raised once more, as one update leaves it. */
function raisedOnce(document: DocumentState): DocumentState {
  const elements = new Map(document.elements);
  for (const element of elements.values()) {
    if (element.rev === Number.MAX_SAFE_INTEGER)
      elements.set(element.id, { ...element, rev: 2 ** 53 });
  }
  return { ...document, elements };
}

interface Run {
  readonly document: DocumentState;
  readonly changes: ChangeSet;
}

/** A scene of 10 to 1,210 elements and a mixed set over it, of up to 1,000 updates. */
function anyRun(random: Random): Run {
  const large = chance(random, 0.3);
  const scene = anyMixedScene(
    random,
    large ? randomInt(random, 1_000, 1_200) : randomInt(random, 0, 150),
  );
  const document = chance(random, 0.2) ? raisedOnce(scene) : scene;
  let next = 10_000;
  return { document, changes: anyMixedSet(random, document, () => (next += 1)) };
}

describe('the planner against the planner before issue 36', () => {
  it(
    'plans every mixed set alike, for every origin, or refuses or throws alike',
    { timeout: 120_000 },
    () => {
      const counts = { runs: 0, planned: 0, largest: 0 };
      checkProperty({ seed: 3661, runs: 60 }, anyRun, ({ document, changes }) => {
        counts.planned += expectSamePlans(stateOf(document), changes);
        counts.runs += 1;
        counts.largest = Math.max(counts.largest, changes.elements.length);
      });
      // Both outcomes ran often, and some sets updated hundreds of elements.
      expect(counts.planned).toBeGreaterThan(40);
      expect(counts.planned).toBeLessThan(counts.runs * ORIGINS.length);
      expect(counts.largest).toBeGreaterThan(500);
    },
  );
});

/** The fixture's elements as a store holds them, the frame at the largest revision. */
const SCENE = anyMixedScene(createRandom(36), 0);

const id = (index: number): ElementId => elementId(index) as ElementId;

function held(index: number): Element {
  const element = SCENE.elements.get(id(index));
  if (element === undefined) throw new Error(`The scene has no element ${String(index)}.`);
  return element;
}

/** An update of the fixture element `index` from the values it holds now. */
function edit(index: number, after: ElementPatch): ElementChange {
  const element = held(index);
  const before = Object.fromEntries(
    Object.keys(after).map((key) => [key, patchValue(element, key)]),
  );
  return { type: 'update', id: id(index), before, after };
}

const raw = (index: number, before: unknown, after: unknown): ElementChange =>
  ({ type: 'update', id: id(index), before, after }) as ElementChange;

const block = (text: string) => ({
  text,
  font: { family: 'mono', size: 9, lineHeight: 2 },
  align: 'right',
});

const CASES: readonly (readonly [string, readonly ElementChange[]])[] = [
  ['a move of held fields', [edit(0, { x: 5, y: -6.5 })]],
  ['a move of every element', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => edit(index, { x: 1 }))],
  ['a turn and a size', [edit(0, { rotation: 1, width: 0, height: LIMITS.size })]],
  [
    'a style, a text and a label',
    [
      edit(3, { style: held(0).style }),
      edit(5, { content: block('x') }),
      edit(6, { label: block('y') }),
    ],
  ],
  [
    'an arrow end moved to another target',
    [edit(6, { end: { target: id(2), anchor: { x: 0, y: 1 } } })],
  ],
  [
    'an arrow end moved to a missing target',
    [edit(6, { end: { target: sceneElementId(5), anchor: { x: 0, y: 1 } } })],
  ],
  ['an arrow attached to itself', [edit(6, { start: { target: id(6), anchor: { x: 0, y: 1 } } })]],
  [
    'freehand points as many as its pressures',
    [
      edit(4, {
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 0 },
          { x: 2, y: 2 },
        ],
      }),
    ],
  ],
  ['freehand points fewer than its pressures', [edit(4, { points: [{ x: 0, y: 0 }] })]],
  ['freehand pressures removed, or too few', [edit(4, { pressures: null }), edit(3, { x: 2 })]],
  ['freehand pressures too few', [edit(4, { pressures: [1] })]],
  ['a field of another kind', [edit(3, { width: 4 })]],
  [
    'a field added and one removed',
    [edit(2, { link: 'https://a.test/' }), edit(0, { link: null, label: null })],
  ],
  ['an absent field written absent', [edit(2, { label: null })]],
  [
    'a group changed, and one added',
    [edit(0, { group: groupId(1) }), edit(2, { group: groupId(0) })],
  ],
  [
    'an identifier, a kind and a revision',
    [edit(0, { id: id(1) }), edit(1, { kind: 'rectangle' }), edit(2, { rev: 9 })],
  ],
  ['a required field removed', [edit(0, { x: null })]],
  ['undefined and minus zero', [raw(0, { x: 0 }, { x: undefined }), edit(1, { x: -0, y: -0 })]],
  [
    'a __proto__ field',
    [raw(2, JSON.parse('{"__proto__":null}'), JSON.parse('{"__proto__":{"x":1}}'))],
  ],
  ['inherited fields only', [raw(2, {}, Object.create({ x: 5 }))]],
  [
    'arrays, strings and numbers as patches',
    [raw(0, [], []), raw(1, [], [5]), raw(2, '', ''), raw(3, 'ab', 'ab'), raw(5, 5, {})],
  ],
  [
    'fields missing from one side',
    [raw(0, { x: 0 }, { x: 1, y: 2 }), raw(1, { x: 0, y: 0, z: 1 }, { x: 1, y: 2 })],
  ],
  ['the largest revision raised', [edit(9, { x: 1 })]],
  ['a stale value', [raw(0, { x: 1 }, { x: 2 }), raw(1, { style: null }, { x: 2 })]],
  [
    'a carriage return and a bad colour',
    [
      edit(0, { label: block('a\rb') }),
      edit(1, { style: { ...held(1).style, stroke: { ...held(1).style.stroke, color: '#12' } } }),
    ],
  ],
  ['nothing changed', [edit(0, { x: held(0).x }), edit(1, {})]],
  ['a patch that is null', [raw(0, { x: 0 }, null)]],
];

describe('the planner against the planner before issue 36, case by case', () => {
  it.each(CASES)('plans %s alike', (_, elements) => {
    expectSamePlans(stateOf(SCENE), changeSet(elements));
  });

  it('plans the largest revision raised once more alike: the update refused at its revision', () => {
    const state = stateOf(raisedOnce(SCENE));
    expectSamePlans(state, changeSet([edit(9, { x: 1 })]));
    expect(planChangeSet(state, changeSet([edit(9, { x: 1 })]), 'remote')).toStrictEqual({
      ok: false,
      errors: [{ path: 'elements[0].after.rev', problem: 'out-of-range' }],
    });
  });

  it('counts the element limit alike', () => {
    const elements = new Map(SCENE.elements);
    for (let index = 0; elements.size < LIMITS.elements - 1; index += 1) {
      elements.set(sceneElementId(index), { ...held(2), id: sceneElementId(index) });
    }
    const state = stateOf({ ...SCENE, elements });
    const add = (index: number, x = 0): ElementChange => ({
      type: 'add',
      element: { ...held(2), id: sceneElementId(LIMITS.elements + index), x },
    });
    const remove: ElementChange = { type: 'remove', element: held(3) };
    for (const changes of [
      [add(0)],
      [add(0), add(1)],
      [add(0), add(1), remove],
      [add(0), add(1, Number.NaN)],
      [add(0), edit(0, { x: 3 }), add(1)],
    ]) {
      expectSamePlans(state, changeSet(changes));
    }
  });
});
