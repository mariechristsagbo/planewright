import type { DocumentState, GroupRecord } from '../../src/model/document.ts';
import type { Element } from '../../src/model/elements.ts';

// One valid document with an element of every kind and every optional field, written as the
// encoder writes it: keys in their fixed order, elements in drawing order, groups by identifier.

/** The identifier of the fixture's element at `index`. */
export const elementId = (index: number): string => `E${String(index).padStart(21, '0')}`;

/** The identifier of the fixture's group at `index`. */
export const groupId = (index: number): string => `G${String(index).padStart(21, '0')}`;

const style = {
  stroke: { color: '#1e2430', width: 2, dash: 'solid' },
  fill: { color: '#ffd8a8', pattern: 'hatch' },
  opacity: 1,
  corners: 'round',
  sketch: 0,
};

const plain = { ...style, fill: null, corners: 'sharp' };

const block = (text: string) => ({
  text,
  font: { family: 'sans', size: 20, lineHeight: 1.25 },
  align: 'center',
});

const head = (index: number, kind: string) => ({
  id: elementId(index),
  kind,
  order: '123456789A'.charAt(index),
  x: 100 * index,
  y: -50 * index,
});

const tail = (index: number) => ({
  rotation: index === 6 ? 0.5 : 0,
  style: index < 3 ? style : plain,
});

export type Json = null | boolean | number | string | Json[] | JsonObject;

export interface JsonObject {
  [key: string]: Json;
}

/** A fresh deep copy of the encoded fixture, safe to change. */
export function fixtureJson(): JsonObject {
  return JSON.parse(JSON.stringify(encodedFixture())) as JsonObject;
}

function encodedFixture(): JsonObject {
  return {
    format: 'planewright',
    schema: 1,
    canvas: { background: '#ffffff' },
    groups: [{ id: groupId(0) }, { id: groupId(1), parent: groupId(0) }],
    elements: [
      {
        ...head(0, 'rectangle'),
        width: 120,
        height: 100,
        ...tail(0),
        locked: false,
        group: groupId(0),
        link: 'https://example.test/a',
        label: block('Box'),
        rev: 3,
      },
      {
        ...head(1, 'ellipse'),
        width: 80,
        height: 40,
        ...tail(1),
        locked: true,
        group: groupId(1),
        rev: 1,
      },
      { ...head(2, 'diamond'), width: 0, height: 1e7, ...tail(2), locked: false, rev: 1 },
      {
        ...head(3, 'line'),
        points: [
          { x: 0, y: 10 },
          { x: 30, y: 0 },
        ],
        ...tail(3),
        locked: false,
        rev: 2,
      },
      {
        ...head(4, 'freehand'),
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 2 },
          { x: 8, y: 1 },
        ],
        pressures: [0.5, 1, 0],
        ...tail(4),
        locked: false,
        rev: 7,
      },
      {
        ...head(5, 'text'),
        width: 42.5,
        height: 25,
        ...tail(5),
        locked: false,
        content: block('Hello\nworld'),
        rev: 1,
      },
      {
        ...head(6, 'arrow'),
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 25 },
        ],
        ...tail(6),
        locked: false,
        link: 'mailto:someone@example.test',
        start: { target: elementId(0), anchor: { x: 1, y: 0.5 } },
        end: { target: elementId(1), anchor: { x: 0, y: 0.5 } },
        heads: { start: 'none', end: 'triangle' },
        route: 'straight',
        label: block('flows'),
        rev: 4,
      },
      {
        ...head(7, 'note'),
        width: 200,
        height: 200,
        ...tail(7),
        locked: false,
        label: block('Note'),
        rev: 1,
      },
      {
        ...head(8, 'image'),
        width: 640,
        height: 480,
        ...tail(8),
        locked: false,
        file: 'ab'.repeat(32),
        crop: { x: 10, y: 20, width: 300, height: 200 },
        rev: 1,
      },
      {
        ...head(9, 'frame'),
        width: 1000,
        height: 800,
        ...tail(9),
        locked: false,
        name: 'Frame 1',
        rev: 1,
      },
    ],
  };
}

/** The fixture as a document; its JSON values are the model's values. */
export function fixtureDocument(): DocumentState {
  const json = fixtureJson() as unknown as {
    readonly canvas: DocumentState['canvas'];
    readonly groups: readonly GroupRecord[];
    readonly elements: readonly Element[];
  };
  return {
    elements: new Map(json.elements.map((element) => [element.id, element])),
    groups: new Map(json.groups.map((group) => [group.id, group])),
    canvas: json.canvas,
    rev: 0,
  };
}

/** A copy of the fixture with the value at `path` replaced, or removed when `value` is undefined. */
export function changed(path: readonly (string | number)[], value: Json | undefined): string {
  const json = fixtureJson();
  let parent: Json = json;
  for (const step of path.slice(0, -1)) {
    parent = (parent as Record<string | number, Json>)[step] ?? null;
  }
  const last = path.at(-1) ?? '';
  const target = parent as Record<string | number, Json>;
  if (value === undefined) {
    Reflect.deleteProperty(target, last);
  } else {
    target[last] = value;
  }
  return JSON.stringify(json);
}
