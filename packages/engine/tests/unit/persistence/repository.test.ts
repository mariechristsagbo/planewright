import { describe, expect, it } from 'vitest';

import type { DocumentState } from '../../../src/model/document.ts';
import type { GroupId } from '../../../src/model/ids.ts';
import { isDocumentId, newDocumentId } from '../../../src/persistence/repository.ts';
import type {
  DocumentDelta,
  DocumentId,
  SaveRequest,
  SessionState,
} from '../../../src/persistence/repository.ts';
import { shapeElement, testId } from '../../support/elements.ts';
import { createCountingIds } from '../../support/fakes.ts';
import { NO_SESSION, memoryStorage, seed } from '../../support/memory-backend.ts';
import { documentOf } from '../../support/selection-scene.ts';

// The repository's revision rule (docs/architecture/engine/persistence.md#repository-port), over
// the tests' in-memory backend: the repository assigns every stored revision, a stale base writes
// nothing, and a session save neither checks nor raises the revision (REQ-P06).

const ID = 'D000000000000000000001' as DocumentId;
const square = (id: number, x = 0) => shapeElement('rectangle', 10, 10, { id, x });
const TWO = documentOf(square(1), square(2, 50));
const GROUP = 'G000000000000000000001' as GroupId;
const MOVED: SessionState = { camera: { x: 30, y: -40, zoom: 2 }, selection: [testId(1)] };

const delta = (baseRev: number, changes: Partial<DocumentDelta> = {}): SaveRequest => ({
  type: 'delta',
  id: ID,
  baseRev,
  delta: {
    upserts: [],
    removals: [],
    groups: { upserts: [], removals: [] },
    canvas: TWO.canvas,
    ...changes,
  },
  session: NO_SESSION,
});

const replace = (baseRev: number, document: DocumentState = TWO): SaveRequest => ({
  type: 'replace',
  id: ID,
  baseRev,
  document,
  session: NO_SESSION,
});

/** The stored document's elements by identifier and its stored revision. */
function storedOf(read: ReturnType<typeof memoryStorage>['read']) {
  const result = read(ID);
  if (result.type !== 'loaded') throw new Error(`The stored document is ${result.type}.`);
  return result.stored;
}

/** The stored records as JSON, to compare before and after. */
const structuredRecords = (backend: ReturnType<typeof memoryStorage>['backend']) =>
  JSON.stringify([[...backend.records], [...backend.elements].map(([id, map]) => [id, [...map]])]);

describe('document identifiers', () => {
  it('have the form of an element identifier, drawn from the identifier source', () => {
    expect(newDocumentId(createCountingIds())).toBe('0000000000000000000001');
    expect([isDocumentId(ID), isDocumentId('short'), isDocumentId(`${ID}!`)]).toEqual([
      true,
      false,
      false,
    ]);
    expect(() => newDocumentId({ next: () => 'not an identifier' })).toThrow(RangeError);
  });
});

describe('the repository assigns every stored revision', () => {
  it('REQ-P06 a first save stores revision 1, and each save raises its base by one', async () => {
    const { repository, read } = memoryStorage();
    expect(await repository.save(delta(0, { upserts: [square(1)] }))).toEqual({ ok: true, rev: 1 });
    expect(await repository.save(delta(1, { upserts: [square(2, 50)] }))).toEqual({
      ok: true,
      rev: 2,
    });
    expect(await repository.save(replace(2))).toEqual({ ok: true, rev: 3 });
    const stored = storedOf(read);
    expect([stored.rev, [...stored.document.elements.keys()]]).toEqual([3, [testId(1), testId(2)]]);
  });

  it('REQ-P06 the stored revision is the base plus one, whatever the document holds', async () => {
    const { backend, repository, read } = memoryStorage();
    seed(backend, { id: ID, rev: 41, document: TWO });
    expect(await repository.save(delta(41))).toEqual({ ok: true, rev: 42 });
    expect(storedOf(read).rev).toBe(42);
  });
});

describe('a stale base', () => {
  it.each([
    ['an older delta', delta(4)],
    ['a newer delta', delta(6)],
    ['an older replacement', replace(4)],
    ['a replacement from nothing', replace(0)],
  ])('REQ-P06 %s is refused with the stored revision, and nothing is written', async (_, save) => {
    const { backend, repository } = memoryStorage();
    seed(backend, { id: ID, rev: 5, document: TWO });
    const before = structuredRecords(backend);
    expect(await repository.save(save)).toEqual({ ok: false, reason: 'stale', storedRev: 5 });
    expect(structuredRecords(backend)).toEqual(before);
    expect(backend.writes()).toBe(0);
  });

  it('REQ-P06 a delta with a base above 0 for a document with no record is stale at 0', async () => {
    const { backend, repository } = memoryStorage();
    expect(await repository.save(delta(3))).toEqual({ ok: false, reason: 'stale', storedRev: 0 });
    expect(backend.records.size).toBe(0);
  });
});

describe('a session save', () => {
  it('REQ-P02 writes only the session, at the stored revision, whatever its base', async () => {
    const { backend, repository, read } = memoryStorage();
    seed(backend, { id: ID, rev: 5, document: TWO });
    const elementsBefore = JSON.stringify([...(backend.elements.get(ID) ?? [])]);
    const result = await repository.save({ type: 'session', id: ID, session: MOVED });
    expect(result).toEqual({ ok: true, rev: 5 });
    const stored = storedOf(read);
    expect([stored.rev, stored.session]).toEqual([5, MOVED]);
    expect(JSON.stringify([...(backend.elements.get(ID) ?? [])])).toBe(elementsBefore);
    expect(await repository.save(delta(5))).toEqual({ ok: true, rev: 6 });
  });

  it('writes nothing for a document with no record yet, which stays at revision 0', async () => {
    const { backend, repository } = memoryStorage();
    const result = await repository.save({ type: 'session', id: ID, session: MOVED });
    expect([result, backend.records.size, backend.writes()]).toEqual([{ ok: true, rev: 0 }, 0, 0]);
  });
});

describe('what a save writes', () => {
  it('REQ-P03 a delta writes its changed elements and deletes its removed ones', async () => {
    const { backend, repository, read } = memoryStorage();
    seed(backend, { id: ID, rev: 1, document: TWO });
    const changes = { upserts: [square(1, 99), square(3, 9)], removals: [testId(2)] };
    expect(await repository.save(delta(1, changes))).toEqual({ ok: true, rev: 2 });
    const { document } = storedOf(read);
    expect([...document.elements.keys()].sort()).toEqual([testId(1), testId(3)]);
    expect(document.elements.get(testId(1))?.x).toBe(99);
    expect([...(backend.elements.get(ID)?.keys() ?? [])].sort()).toEqual([testId(1), testId(3)]);
  });

  it('a delta merges its groups into the stored ones', async () => {
    const { backend, repository, read } = memoryStorage();
    seed(backend, { id: ID, rev: 1, document: TWO });
    const grouped = { ...square(1), group: GROUP };
    const added = { upserts: [grouped], groups: { upserts: [{ id: GROUP }], removals: [] } };
    await repository.save(delta(1, added));
    expect([...storedOf(read).document.groups.keys()]).toEqual([GROUP]);
    const dropped = { upserts: [square(1)], groups: { upserts: [], removals: [GROUP] } };
    await repository.save(delta(2, dropped));
    expect(storedOf(read).document.groups.size).toBe(0);
  });

  it('a replacement stores nested groups with their parents', async () => {
    const { repository, read } = memoryStorage();
    const inner = 'G000000000000000000002' as GroupId;
    const nested: DocumentState = {
      ...documentOf({ ...square(1), group: inner }),
      groups: new Map([
        [GROUP, { id: GROUP }],
        [inner, { id: inner, parent: GROUP }],
      ]),
    };
    expect(await repository.save(replace(0, nested))).toEqual({ ok: true, rev: 1 });
    expect([...storedOf(read).document.groups.values()]).toEqual([
      { id: GROUP },
      { id: inner, parent: GROUP },
    ]);
  });

  it('REQ-P03 a replacement removes every stored element that the document does not hold', async () => {
    const { backend, repository, read } = memoryStorage();
    seed(backend, { id: ID, rev: 7, document: TWO });
    const only = documentOf(square(5, 20));
    expect(await repository.save(replace(7, only))).toEqual({ ok: true, rev: 8 });
    expect([...storedOf(read).document.elements.keys()]).toEqual([testId(5)]);
    expect([...(backend.elements.get(ID)?.keys() ?? [])]).toEqual([testId(5)]);
  });

  it('REQ-P05 a backend that throws is a failed save, and one that reports a failure passes it on', async () => {
    const { backend, repository } = memoryStorage();
    backend.fail('throw');
    backend.fail({ ok: false, reason: 'quota' });
    expect(await repository.save(delta(0))).toEqual({ ok: false, reason: 'failed' });
    expect(await repository.save(delta(0))).toEqual({ ok: false, reason: 'quota' });
    expect(await repository.save(delta(0))).toEqual({ ok: true, rev: 1 });
  });

  it.each([
    ['not an object', 'text'],
    ['a fractional revision', { rev: 1.5, groups: [] }],
    ['a negative revision', { rev: -1, groups: [] }],
    ['groups that are not a list', { rev: 1, groups: {} }],
    ['a group without an identifier', { rev: 1, groups: [{}] }],
  ])('a stored record with %s is never written over', async (_, record) => {
    const { backend, repository } = memoryStorage();
    backend.records.set(ID, record as never);
    expect(await repository.save(delta(1))).toEqual({ ok: false, reason: 'failed' });
    expect(await repository.save({ type: 'session', id: ID, session: MOVED })).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect([backend.records.get(ID), backend.writes()]).toEqual([record, 0]);
  });
});
