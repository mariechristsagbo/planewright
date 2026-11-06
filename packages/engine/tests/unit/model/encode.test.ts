import { describe, expect, it } from 'vitest';

import { INITIAL_DEFAULT_STYLE } from '../../../src/model/defaults.ts';
import type { DocumentState, GroupRecord } from '../../../src/model/document.ts';
import type { Element, ShapeElement } from '../../../src/model/elements.ts';
import { encodeDocument } from '../../../src/model/encode.ts';
import type { ElementId, GroupId } from '../../../src/model/ids.ts';
import type { OrderKey } from '../../../src/model/order-key.ts';
import { anyDocument, reordered } from '../../support/documents.ts';
import { fixtureDocument, fixtureJson } from '../../support/fixtures.ts';
import { checkProperty } from '../../support/property.ts';

const rectangle: ShapeElement = {
  id: 'pW3xK9vT2mQe7LhR0aZc5Q' as ElementId,
  kind: 'rectangle',
  order: 'V' as OrderKey,
  x: 300,
  y: 180,
  width: 120,
  height: 100,
  rotation: 0,
  style: INITIAL_DEFAULT_STYLE,
  locked: false,
  rev: 1,
};

function documentOf(
  elements: readonly Element[],
  groups: readonly GroupRecord[] = [],
): DocumentState {
  return {
    elements: new Map(elements.map((element) => [element.id, element])),
    groups: new Map(groups.map((group) => [group.id, group])),
    canvas: { background: INITIAL_DEFAULT_STYLE.stroke.color },
    rev: 0,
  };
}

const parsed = (document: DocumentState) =>
  JSON.parse(encodeDocument(document)) as {
    elements: { id: string; order: string }[];
    groups: { id: string }[];
  };

describe('encodeDocument', () => {
  it("writes the domain model's example byte for byte, without white space", () => {
    const document = { ...documentOf([rectangle]), canvas: fixtureDocument().canvas };
    expect(encodeDocument(document)).toBe(
      '{"format":"planewright","schema":1,"canvas":{"background":"#ffffff"},"groups":[],' +
        '"elements":[{"id":"pW3xK9vT2mQe7LhR0aZc5Q","kind":"rectangle","order":"V","x":300,' +
        '"y":180,"width":120,"height":100,"rotation":0,"style":{"stroke":{"color":"#1e2430",' +
        '"width":2,"dash":"solid"},"fill":null,"opacity":1,"corners":"round","sketch":0},' +
        '"locked":false,"rev":1}]}',
    );
  });

  it('writes every kind with its fields in a fixed order and its optional fields when present', () => {
    expect(encodeDocument(fixtureDocument())).toBe(JSON.stringify(fixtureJson()));
  });

  it('REQ-K02 writes elements in drawing order and groups by identifier, whatever the maps hold', () => {
    const at = (id: string, order: string): ShapeElement => ({
      ...rectangle,
      id: id.padEnd(22, 'x') as ElementId,
      order: order as OrderKey,
    });
    const group = (id: string): GroupRecord => ({ id: id.padEnd(22, 'x') as GroupId });
    const document = documentOf(
      [at('b', 'V'), at('z', 'k'), at('a', 'V'), at('B', 'V'), at('y', 'F')],
      [group('b'), group('a'), group('A')],
    );
    const { elements, groups } = parsed(document);
    expect(elements.map(({ id, order }) => `${order}${id.charAt(0)}`)).toEqual([
      'Fy',
      'VB',
      'Va',
      'Vb',
      'kz',
    ]);
    expect(groups.map(({ id }) => id.charAt(0))).toEqual(['A', 'a', 'b']);
  });

  it('never writes the in-memory revision of the document', () => {
    const document = { ...documentOf([rectangle]), rev: 41 };
    expect(encodeDocument(document)).toBe(encodeDocument(documentOf([rectangle])));
    expect(Object.keys(JSON.parse(encodeDocument(document)) as object)).toEqual([
      'format',
      'schema',
      'canvas',
      'groups',
      'elements',
    ]);
  });

  it('writes only the fields of the model', () => {
    const stray = { ...rectangle, selected: true, style: { ...rectangle.style, theme: 'dark' } };
    expect(encodeDocument(documentOf([stray]))).toBe(encodeDocument(documentOf([rectangle])));
  });

  it('is byte-stable: the same document gives the same text, whatever its maps and key orders', () => {
    checkProperty(
      { seed: 0xb17e, runs: 300 },
      (random) => {
        const document = anyDocument(random);
        return { document, again: reordered(random, document) };
      },
      ({ document, again }) => {
        expect(encodeDocument(again)).toBe(encodeDocument(document));
      },
    );
  });
});
