import { encodeElement } from '../model/encode.ts';
import type { CanvasState, DocumentState, GroupRecord } from '../model/document.ts';
import type { Element } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { isRecord } from '../model/json-check.ts';
import { compareCodeUnits } from '../model/order-key.ts';
import { CURRENT_SCHEMA } from '../model/schema.ts';
import type { DocumentId, SaveRequest, SaveResult, SessionState } from './repository.ts';

// The records a storage backend holds (docs/architecture/engine/persistence.md#indexeddb-layout):
// one document record with the revision, the canvas, the groups and the session, and one record
// per element, encoded as the document format encodes it. `planSave` applies the revision rule to
// the stored document record, inside the backend's one transaction.

/** An element as stored: the document it belongs to, its identifier and its encoding. */
export interface ElementRecord {
  readonly document: DocumentId;
  readonly id: ElementId;
  readonly element: ReturnType<typeof encodeElement>;
}

/** A document record as a save writes it; the backend adds the time of the update. */
export type DocumentRecord = Readonly<Record<string, unknown>>;

/** What a save writes, all in one transaction, or nothing. */
export type SavePlan =
  | { readonly type: 'none'; readonly result: SaveResult }
  | {
      readonly type: 'write';
      readonly result: SaveResult;
      readonly record: DocumentRecord;
      /** Delete every element record of the document before the others are written. */
      readonly clear: boolean;
      readonly put: readonly ElementRecord[];
      readonly remove: readonly ElementId[];
    };

/** Reads and writes records; the IndexedDB adapter in the web app, a map in tests. */
export interface RecordBackend {
  /**
   * The most recently updated document record and its element records, or null when there is
   * none; rejects when storage cannot be opened.
   */
  latest(): Promise<{ readonly record: unknown; readonly elements: readonly unknown[] } | null>;
  /**
   * In one transaction: reads the document's record (undefined when there is none), asks the plan
   * what to write, writes it and returns the plan's result, or a failure if the writes fail.
   */
  transact(id: DocumentId, plan: (record: unknown) => SavePlan): Promise<SaveResult>;
}

const FAILED: SaveResult = { ok: false, reason: 'failed' };

const encodeGroup = ({ id, parent }: GroupRecord) =>
  parent === undefined ? { id } : { id, parent };

const encodeCanvas = ({ background }: CanvasState) => ({ background });

/** The session as plain data, so that a stored record holds nothing but values. */
export const sessionRecord = ({ camera, selection }: SessionState) => ({
  camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
  selection: [...selection],
});

const elementRecords = (id: DocumentId, elements: Iterable<Element>): ElementRecord[] =>
  [...elements].map((element) => ({
    document: id,
    id: element.id,
    element: encodeElement(element),
  }));

/** Groups by identifier, so that the same groups always give the same record. */
const sortedGroups = (groups: readonly { readonly id: string }[]) =>
  [...groups].sort((a, b) => compareCodeUnits(a.id, b.id));

/** Stored groups, each with a string identifier. */
type StoredGroups = readonly { readonly id: string }[];

const isGroupList = (value: unknown): value is StoredGroups =>
  Array.isArray(value) &&
  value.every((group) => isRecord(group) && typeof group['id'] === 'string');

/** The stored groups with the delta's removed and changed ones replaced by its changed ones. */
function mergeGroups(stored: StoredGroups, delta: SaveRequest & { readonly type: 'delta' }) {
  const { upserts, removals } = delta.delta.groups;
  const gone = new Set<string>([...removals, ...upserts.map(({ id }) => id)]);
  const kept = stored.filter(({ id }) => !gone.has(id));
  return sortedGroups([...kept, ...upserts.map(encodeGroup)]);
}

function writing(
  record: DocumentRecord,
  rev: number,
  put: ElementRecord[],
  options = {},
): SavePlan {
  return {
    type: 'write',
    result: { ok: true, rev },
    record,
    clear: false,
    put,
    remove: [],
    ...options,
  };
}

const documentRecord = (
  id: DocumentId,
  rev: number,
  canvas: CanvasState,
  groups: StoredGroups,
) => ({
  id,
  schema: CURRENT_SCHEMA,
  rev,
  canvas: encodeCanvas(canvas),
  groups,
});

/** A delta: the changed elements written, the removed ones deleted, the record at `rev`. */
function deltaPlan(
  request: SaveRequest & { readonly type: 'delta' },
  groups: StoredGroups,
  rev: number,
) {
  const { id, delta, session } = request;
  const record = {
    ...documentRecord(id, rev, delta.canvas, mergeGroups(groups, request)),
    session: sessionRecord(session),
  };
  return writing(record, rev, elementRecords(id, delta.upserts), { remove: [...delta.removals] });
}

/** A replacement: every element record of the document deleted, then all of its elements written. */
function replacePlan(
  {
    id,
    document,
    session,
  }: { readonly id: DocumentId; readonly document: DocumentState; readonly session: SessionState },
  rev: number,
) {
  const groups = sortedGroups([...document.groups.values()].map(encodeGroup));
  const record = {
    ...documentRecord(id, rev, document.canvas, groups),
    session: sessionRecord(session),
  };
  return writing(record, rev, elementRecords(id, document.elements.values()), { clear: true });
}

/** The stored revision and groups of a record a save can build on, or undefined. */
function readable(stored: unknown) {
  if (!isRecord(stored)) return undefined;
  const { rev, groups } = stored;
  const valid = typeof rev === 'number' && Number.isSafeInteger(rev) && rev >= 0;
  return valid && isGroupList(groups) ? { record: stored, rev, groups } : undefined;
}

/**
 * The revision rule (REQ-P06): a delta or a replacement whose base equals the stored revision
 * writes and sets it to `baseRev + 1`; any other base writes nothing and reports the stored one.
 * A session save writes only the record's session and keeps its revision; with no record yet it
 * writes nothing, at revision 0. A record that a save cannot read is never written over.
 */
export function planSave(stored: unknown, request: SaveRequest): SavePlan {
  const found = stored === undefined ? { record: undefined, rev: 0, groups: [] } : readable(stored);
  if (found === undefined) return { type: 'none', result: FAILED };
  if (request.type === 'session') {
    if (found.record === undefined) return { type: 'none', result: { ok: true, rev: 0 } };
    return writing({ ...found.record, session: sessionRecord(request.session) }, found.rev, []);
  }
  if (request.baseRev !== found.rev) {
    return { type: 'none', result: { ok: false, reason: 'stale', storedRev: found.rev } };
  }
  return request.type === 'delta'
    ? deltaPlan(request, found.groups, found.rev + 1)
    : replacePlan(request, found.rev + 1);
}
