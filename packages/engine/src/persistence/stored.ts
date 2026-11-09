import { DEFAULT_CAMERA, limitCamera } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import type { CodecError } from '../model/codec.ts';
import { decodeDocument } from '../model/decode.ts';
import type { DocumentState } from '../model/document.ts';
import type { ElementId } from '../model/ids.ts';
import { isRecord } from '../model/json-check.ts';
import { FORMAT } from '../model/schema.ts';
import { isDocumentId } from './repository.ts';
import type { DocumentId, LoadResult, SessionState } from './repository.ts';

// Loading stored records (docs/architecture/engine/persistence.md#loading): the document goes
// through the one codec and is refused whole if any part of it is invalid (REQ-P07); the session
// beside it is only ever narrowed to what can be used.

const invalid = (errors: readonly CodecError[]): LoadResult => ({ type: 'invalid', errors });

const isNumber = (value: unknown): value is number => typeof value === 'number';

/** A stored camera within the limits; one that is not three numbers gives the default camera. */
function readCamera(value: unknown): Camera {
  if (!isRecord(value)) return { ...DEFAULT_CAMERA };
  const { x, y, zoom } = value;
  if (!isNumber(x) || !isNumber(y) || !isNumber(zoom)) return { ...DEFAULT_CAMERA };
  return limitCamera({ x, y, zoom }, DEFAULT_CAMERA);
}

/**
 * The stored session, narrowed to what can be used: the camera within its limits, NaN giving the
 * default camera (the ENG-05 review's m1), and the selection filtered to the document's elements,
 * each once, which drops elements another tab has removed since.
 */
export function readSession(value: unknown, document: DocumentState): SessionState {
  const stored = isRecord(value) ? value : {};
  const ids = Array.isArray(stored['selection']) ? (stored['selection'] as unknown[]) : [];
  const selection = ids.filter(
    (id): id is ElementId => typeof id === 'string' && document.elements.has(id as ElementId),
  );
  return { camera: readCamera(stored['camera']), selection: [...new Set(selection)] };
}

/** The element in each element record, and the records that keep the others from being read. */
function elementsOf(records: readonly unknown[]) {
  const errors: CodecError[] = [];
  const elements = records.map((record, index) => {
    const element = isRecord(record) ? record['element'] : undefined;
    const id = isRecord(element) ? element['id'] : undefined;
    // A record kept under one identifier that holds another element is refused, or deleting the
    // element would leave the record behind.
    if (!isRecord(record) || record['id'] !== id) {
      errors.push({ path: `elements[${String(index)}].id`, problem: 'malformed-id' });
    }
    return element;
  });
  return { elements, errors };
}

/** The record's identifier and revision, checked before anything else of it is read. */
function headerErrors({ id, rev }: Readonly<Record<string, unknown>>): CodecError[] {
  const errors: CodecError[] = [];
  if (typeof id !== 'string' || !isDocumentId(id)) {
    errors.push({ path: 'id', problem: 'malformed-id' });
  }
  if (!isNumber(rev) || !Number.isSafeInteger(rev) || rev < 0) {
    errors.push({ path: 'rev', problem: 'not-integer' });
  }
  return errors;
}

/** The records as the document format's text, or undefined if they hold what JSON cannot. */
function encodedText(record: Readonly<Record<string, unknown>>, elements: readonly unknown[]) {
  const { schema, canvas, groups } = record;
  try {
    return JSON.stringify({ format: FORMAT, schema, canvas, groups, elements });
  } catch {
    return undefined;
  }
}

/**
 * A backend's latest records as a load result: none gives `empty`; records that fail any check,
 * the codec's included, give `invalid` with the errors and nothing else (REQ-P07); valid ones give
 * the document with its stored revision and session.
 */
export function readStored(
  found: { readonly record: unknown; readonly elements: readonly unknown[] } | null,
): LoadResult {
  if (found === null) return { type: 'empty' };
  const { record } = found;
  if (!isRecord(record)) return invalid([{ path: '', problem: 'not-object' }]);
  const { elements, errors } = elementsOf(found.elements);
  const refused = [...headerErrors(record), ...errors];
  if (refused.length > 0) return invalid(refused);
  const text = encodedText(record, elements);
  if (text === undefined) return invalid([{ path: '', problem: 'syntax' }]);
  const decoded = decodeDocument(text);
  if (!decoded.ok) return invalid(decoded.errors);
  return {
    type: 'loaded',
    stored: {
      id: record['id'] as DocumentId,
      rev: record['rev'] as number,
      document: decoded.value,
      session: readSession(record['session'], decoded.value),
    },
  };
}
