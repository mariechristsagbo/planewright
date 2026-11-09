import { describe, expect, it } from 'vitest';

import type { ElementId } from '../../../src/model/ids.ts';
import type { DocumentId, SessionState } from '../../../src/persistence/repository.ts';
import { readSession } from '../../../src/persistence/stored.ts';
import { shapeElement, testId } from '../../support/elements.ts';
import { NO_SESSION, memoryStorage, seed } from '../../support/memory-backend.ts';
import { documentOf } from '../../support/selection-scene.ts';

// Loading through the repository (docs/architecture/engine/persistence.md#loading): the most
// recently updated document, through the one codec; invalid records are refused whole and left
// as they are (REQ-P07); the session is narrowed to what can be used.

const A = 'D000000000000000000001' as DocumentId;
const B = 'D000000000000000000002' as DocumentId;
const TWO = documentOf(
  shapeElement('rectangle', 10, 10, { id: 1 }),
  shapeElement('ellipse', 20, 20, { id: 2, x: 40 }),
);
const SESSION: SessionState = { camera: { x: 5, y: 6, zoom: 3 }, selection: [testId(2)] };

describe('loading', () => {
  it('REQ-P02 gives the most recently updated document with its revision and session', async () => {
    const { backend, repository } = memoryStorage();
    seed(backend, { id: A, rev: 3, document: TWO }, SESSION);
    seed(backend, { id: B, rev: 9, document: documentOf() });
    await repository.save({ type: 'session', id: A, session: SESSION });
    const result = await repository.load();
    if (result.type !== 'loaded') throw new Error(result.type);
    expect([result.stored.id, result.stored.rev, result.stored.session]).toEqual([A, 3, SESSION]);
    expect(result.stored.document.elements).toEqual(TWO.elements);
    expect([result.stored.document.canvas, result.stored.document.groups.size]).toEqual([
      TWO.canvas,
      0,
    ]);
  });

  it('is empty without any record, and unavailable when storage cannot be opened', async () => {
    const { backend, repository } = memoryStorage();
    expect(await repository.load()).toEqual({ type: 'empty' });
    backend.close();
    expect(await repository.load()).toEqual({ type: 'unavailable' });
  });
});

/** Seeds A, breaks its records with `spoil`, loads, and checks that the records are untouched. */
async function loadSpoiled(spoil: (backend: ReturnType<typeof memoryStorage>['backend']) => void) {
  const { backend, repository } = memoryStorage();
  seed(backend, { id: A, rev: 3, document: TWO }, SESSION);
  spoil(backend);
  const record = backend.records.get(A);
  const elements = [...(backend.elements.get(A) ?? [])];
  const result = await repository.load();
  expect(backend.records.get(A)).toBe(record);
  expect([...(backend.elements.get(A) ?? [])]).toStrictEqual(elements);
  expect(backend.writes()).toBe(0);
  return result;
}

const recordOf = (backend: ReturnType<typeof memoryStorage>['backend']) =>
  backend.records.get(A) ?? {};

describe('invalid stored data', () => {
  it.each([
    ['a record that is not an object', '', 'not-object', (b) => b.records.set(A, 7 as never)],
    [
      'a malformed identifier',
      'id',
      'malformed-id',
      (b) => b.records.set(A, { ...recordOf(b), id: 'x' }),
    ],
    [
      'a fractional revision',
      'rev',
      'not-integer',
      (b) => b.records.set(A, { ...recordOf(b), rev: 0.5 }),
    ],
    [
      'a newer schema',
      'schema',
      'newer-schema',
      (b) => b.records.set(A, { ...recordOf(b), schema: 2 }),
    ],
    [
      'an element out of range',
      'elements[0].x',
      'out-of-range',
      (b) => {
        const element = { ...shapeElement('rectangle', 1, 1, { id: 1 }), x: 2e9 };
        b.elements.get(A)?.set(testId(1), { document: A, id: testId(1), element });
      },
    ],
    [
      'an element kept under another identifier',
      'elements[1].id',
      'malformed-id',
      (b) => {
        const element = shapeElement('rectangle', 1, 1, { id: 1 });
        b.elements.get(A)?.set(testId(2), { document: A, id: testId(2), element });
      },
    ],
    [
      'an element record that is not an object',
      'elements[2].id',
      'malformed-id',
      (b) => b.elements.get(A)?.set('stray', 5),
    ],
    [
      'a NaN canvas colour',
      'canvas.background',
      'not-string',
      (b) => b.records.set(A, { ...recordOf(b), canvas: { background: Number.NaN } }),
    ],
  ] satisfies [
    string,
    string,
    string,
    (backend: ReturnType<typeof memoryStorage>['backend']) => void,
  ][])('REQ-P07 %s is refused whole and left as it is', async (_, path, problem, spoil) => {
    const result = await loadSpoiled(spoil);
    expect(result.type).toBe('invalid');
    expect(result.type === 'invalid' ? result.errors : []).toContainEqual({ path, problem });
  });

  it('REQ-P07 records that JSON cannot hold, such as a cycle, are refused whole', async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    const result = await loadSpoiled((b) => b.records.set(A, { ...recordOf(b), canvas: cyclic }));
    expect(result).toEqual({ type: 'invalid', errors: [{ path: '', problem: 'syntax' }] });
  });
});

describe('the stored session', () => {
  const read = (value: unknown) => readSession(value, TWO);

  it('REQ-V11 keeps a camera within the limits and the selected elements that exist', () => {
    expect(read(SESSION)).toEqual(SESSION);
    expect(read({ camera: { x: 2e9, y: -Infinity, zoom: 99 }, selection: [] }).camera).toEqual({
      x: 1e9,
      y: -1e9,
      zoom: 30,
    });
  });

  it('REQ-V08 a camera that holds NaN or is not three numbers gives the default camera', () => {
    for (const camera of [{ x: Number.NaN, y: 0, zoom: 1 }, { x: 1, y: 2 }, 'far', null]) {
      expect(read({ camera, selection: [] }).camera).toEqual({ x: 0, y: 0, zoom: 1 });
    }
    expect(read(undefined)).toEqual(NO_SESSION);
  });

  it('REQ-P02 drops selected elements that no longer exist, repeats and non-identifiers', () => {
    const selection = [testId(2), testId(9), testId(2), 4, testId(1)] as unknown as ElementId[];
    expect(read({ camera: SESSION.camera, selection }).selection).toEqual([testId(2), testId(1)]);
    expect(read({ camera: SESSION.camera, selection: 'all' }).selection).toEqual([]);
  });
});
