import type { CodecError, Decoded } from './codec.ts';
import type { CanvasState, DocumentState, GroupRecord } from './document.ts';
import { checkElement } from './element-checks.ts';
import type { Element } from './elements.ts';
import { color, groupId } from './field-checks.ts';
import { INVALID, integerIn, isRecord, listOf, oneOf, record } from './json-check.ts';
import type { Issues } from './json-check.ts';
import { LIMITS } from './limits.ts';
import { MIGRATIONS, migrate } from './migrations.ts';
import type { Migration } from './migrations.ts';
import { checkReferences } from './references.ts';
import { FORMAT } from './schema.ts';
import { exceedsUtf8Bytes } from './utf8.ts';

interface EncodedDocument {
  readonly format: string;
  readonly schema: number;
  readonly canvas: CanvasState;
  readonly groups: readonly GroupRecord[];
  readonly elements: readonly Element[];
}

const encodedDocument = record<EncodedDocument>({
  format: oneOf([FORMAT]),
  schema: integerIn(1, Number.MAX_SAFE_INTEGER),
  canvas: record<CanvasState>({ background: color }),
  groups: listOf(record<GroupRecord>({ id: groupId, parent: { optional: groupId } }), {
    min: 0,
    max: Number.POSITIVE_INFINITY,
  }),
  elements: listOf(checkElement, { min: 0, max: LIMITS.elements }),
});

const refuse = (errors: readonly CodecError[]): Decoded<never> => ({ ok: false, errors });

function parse(text: string): { readonly value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return undefined;
  }
}

function formatError(document: Readonly<Record<string, unknown>>): CodecError | undefined {
  if (!Object.hasOwn(document, 'format')) {
    return { path: 'format', problem: 'missing' };
  }
  return document['format'] === FORMAT ? undefined : { path: 'format', problem: 'wrong-format' };
}

/** The document's schema number, or why this version cannot read it. */
function readSchema(
  document: Readonly<Record<string, unknown>>,
  current: number,
): number | CodecError {
  const schema = document['schema'];
  if (!Object.hasOwn(document, 'schema')) {
    return { path: 'schema', problem: 'missing' };
  }
  if (typeof schema !== 'number' || !Number.isSafeInteger(schema) || schema < 1) {
    return { path: 'schema', problem: 'invalid-schema' };
  }
  // A newer document may hold anything, so nothing else of it is read.
  return schema > current ? { path: 'schema', problem: 'newer-schema' } : schema;
}

interface Envelope {
  readonly document: Readonly<Record<string, unknown>>;
  readonly schema: number;
}

/** The format and schema, checked before anything else so that a newer schema has its own error. */
function readEnvelope(value: unknown, current: number): Envelope | CodecError[] {
  if (!isRecord(value)) {
    return [{ path: '', problem: 'not-object' }];
  }
  const schema = readSchema(value, current);
  const errors = [formatError(value), typeof schema === 'number' ? undefined : schema];
  const found = errors.filter((error) => error !== undefined);
  return found.length > 0 || typeof schema !== 'number' ? found : { document: value, schema };
}

const toDocument = ({ canvas, groups, elements }: EncodedDocument): DocumentState => ({
  elements: new Map(elements.map((element) => [element.id, element])),
  groups: new Map(groups.map((group) => [group.id, group])),
  canvas,
  rev: 0,
});

/**
 * {@link decodeDocument} with a given list of migrations, whose length fixes the newest schema
 * that it reads.
 */
export function decodeWith(text: string, migrations: readonly Migration[]): Decoded<DocumentState> {
  if (exceedsUtf8Bytes(text, LIMITS.encodedBytes)) {
    return refuse([{ path: '', problem: 'too-large' }]);
  }
  const parsed = parse(text);
  if (parsed === undefined) {
    return refuse([{ path: '', problem: 'syntax' }]);
  }
  const envelope = readEnvelope(parsed.value, migrations.length + 1);
  if (Array.isArray(envelope)) {
    return refuse(envelope);
  }
  const issues: Issues = [];
  const read = encodedDocument(migrate(envelope.document, envelope.schema, migrations), '', issues);
  if (read === INVALID) {
    return refuse(issues);
  }
  checkReferences(read, issues);
  return issues.length > 0 ? refuse(issues) : { ok: true, value: toDocument(read) };
}

/**
 * Decodes untrusted document text (docs/architecture/engine/persistence.md#the-codec-boundary):
 * the size is checked before parsing, then the format and schema, older schemas are migrated, and
 * every field and cross-reference is checked. The result is the whole document, or the errors
 * with their JSON paths and nothing else; input is never repaired or partly kept (REQ-P07).
 */
export const decodeDocument = (text: string): Decoded<DocumentState> =>
  decodeWith(text, MIGRATIONS);
