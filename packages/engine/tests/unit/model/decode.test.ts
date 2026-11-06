import { describe, expect, it } from 'vitest';

import { randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { decodeDocument, decodeWith } from '../../../src/model/decode.ts';
import { encodeDocument } from '../../../src/model/encode.ts';
import type { Migration } from '../../../src/model/migrations.ts';
import { anyDocument } from '../../support/documents.ts';
import { changed, fixtureDocument, fixtureJson } from '../../support/fixtures.ts';
import type { Json } from '../../support/fixtures.ts';
import { checkProperty } from '../../support/property.ts';

const LIMIT = 50_000_000;
const refused = (path: string, problem: string) => ({ ok: false, errors: [{ path, problem }] });

describe('decodeDocument', () => {
  it('REQ-P07 returns the whole document, with an in-memory revision of 0', () => {
    expect(decodeDocument(JSON.stringify(fixtureJson()))).toStrictEqual({
      ok: true,
      value: fixtureDocument(),
    });
  });

  // The inputs of 50 MB take a few seconds under coverage on CI.
  it('REQ-P07 refuses input over 50 MB of UTF-8 before parsing it', { timeout: 30_000 }, () => {
    expect(decodeDocument('x'.repeat(LIMIT + 1))).toStrictEqual(refused('', 'too-large'));
    expect(decodeDocument('é'.repeat(LIMIT / 2 + 1))).toStrictEqual(refused('', 'too-large'));
    expect(decodeDocument('😀'.repeat(LIMIT / 4 + 1))).toStrictEqual(refused('', 'too-large'));
    expect(decodeDocument('é'.repeat(LIMIT / 2))).toStrictEqual(refused('', 'syntax'));
  });

  it('accepts a valid document of exactly 50 MB', { timeout: 30_000 }, () => {
    const text = JSON.stringify(fixtureJson());
    expect(decodeDocument(text.padEnd(LIMIT, ' ')).ok).toBe(true);
    expect(decodeDocument(text.padEnd(LIMIT + 1, ' '))).toStrictEqual(refused('', 'too-large'));
  });

  it.each(['', '{', '{"format":', 'NaN', '{"a":1,}', "{'a':1}"])(
    'REQ-P07 reports a syntax error in %j as one error at the root',
    (text) => {
      expect(decodeDocument(text)).toStrictEqual(refused('', 'syntax'));
    },
  );

  it.each(['[]', 'null', '42', '"planewright"'])('refuses the root value %s', (text) => {
    expect(decodeDocument(text)).toStrictEqual(refused('', 'not-object'));
  });

  it('refuses another format or a schema that is not a positive integer', () => {
    expect(decodeDocument(changed(['format'], 'excalidraw'))).toStrictEqual(
      refused('format', 'wrong-format'),
    );
    expect(decodeDocument(changed(['format'], undefined))).toStrictEqual(
      refused('format', 'missing'),
    );
    expect(decodeDocument(changed(['schema'], undefined))).toStrictEqual(
      refused('schema', 'missing'),
    );
    for (const schema of ['1', 0, -1, 1.5, null, 2 ** 53]) {
      expect(decodeDocument(changed(['schema'], schema))).toStrictEqual(
        refused('schema', 'invalid-schema'),
      );
    }
  });

  it('REQ-P07 refuses a newer schema with its own message, before reading anything else', () => {
    expect(decodeDocument(changed(['schema'], 2))).toStrictEqual(refused('schema', 'newer-schema'));
    const unreadable = JSON.stringify({ format: 'planewright', schema: 7, elements: 'later' });
    expect(decodeDocument(unreadable)).toStrictEqual(refused('schema', 'newer-schema'));
    const foreign = JSON.stringify({ format: 'other', schema: 7 });
    expect(decodeDocument(foreign)).toStrictEqual({
      ok: false,
      errors: [
        { path: 'format', problem: 'wrong-format' },
        { path: 'schema', problem: 'newer-schema' },
      ],
    });
  });

  it('refuses unknown fields at the root and checks every field below it', () => {
    expect(decodeDocument(changed(['extra'], 1))).toStrictEqual(refused('extra', 'unknown-field'));
    expect(decodeDocument(changed(['canvas'], undefined))).toStrictEqual(
      refused('canvas', 'missing'),
    );
    expect(decodeDocument(changed(['groups'], {}))).toStrictEqual(refused('groups', 'not-array'));
    expect(decodeDocument(changed(['elements'], null))).toStrictEqual(
      refused('elements', 'not-array'),
    );
  });

  it('checks cross-references only once every field is valid', () => {
    const text = JSON.stringify({
      ...fixtureJson(),
      groups: [{ id: 'G000000000000000000000', parent: 'G000000000000000000009' }],
      canvas: { background: 'white' },
    });
    expect(decodeDocument(text)).toStrictEqual(refused('canvas.background', 'malformed-color'));
  });
});

describe('the migration scaffold', () => {
  // A made-up first migration: schema 1 called the canvas "paper".
  const steps: readonly Migration[] = [({ paper, ...rest }) => ({ ...rest, canvas: paper })];
  const { canvas, ...rest } = fixtureJson();

  it('migrates an older document before checking it like any input', () => {
    const decoded = decodeWith(JSON.stringify({ ...rest, paper: canvas }), steps);
    expect(decoded).toStrictEqual({ ok: true, value: fixtureDocument() });
  });

  it('refuses what a migration could not turn into a valid document', () => {
    const decoded = decodeWith(JSON.stringify({ ...rest, paper: { background: 'none' } }), steps);
    expect(decoded).toStrictEqual(refused('canvas.background', 'malformed-color'));
  });

  it('refuses a schema newer than its last migration', () => {
    expect(decodeWith(changed(['schema'], 3), steps)).toStrictEqual(
      refused('schema', 'newer-schema'),
    );
  });
});

/** A value to put in place of a part of a document. */
const junk = (random: Random): Json =>
  [null, -1, 0, 1e300, true, '', 'x', [], {}, [null], { x: 1 }][randomInt(random, 0, 10)] ?? null;

/** Replaces one random node of a JSON value with junk, in place. */
function damage(random: Random, value: Json): void {
  let node = value;
  for (;;) {
    const keys = node !== null && typeof node === 'object' ? Object.keys(node) : [];
    const key = keys[randomInt(random, 0, Math.max(0, keys.length - 1))];
    const container = node as Record<string, Json>;
    if (key === undefined) return;
    if (random.next() < 0.3 || typeof container[key] !== 'object' || container[key] === null) {
      container[key] = junk(random);
      return;
    }
    node = container[key];
  }
}

describe('decoding properties', () => {
  it('REQ-P07 decoding an encoded document returns it', { timeout: 30_000 }, () => {
    checkProperty({ seed: 0xdec0, runs: 300 }, anyDocument, (document) => {
      expect(decodeDocument(encodeDocument(document))).toStrictEqual({
        ok: true,
        value: { ...document, rev: 0 },
      });
    });
  });

  it('encoding a decoded document gives the same bytes', () => {
    checkProperty({ seed: 0xdec1, runs: 300 }, anyDocument, (document) => {
      const text = encodeDocument(document);
      const decoded = decodeDocument(text);
      expect(decoded.ok && encodeDocument(decoded.value)).toBe(text);
    });
  });

  it(
    'REQ-P07 a damaged document is refused whole or read whole, never in part',
    { timeout: 30_000 },
    () => {
      checkProperty(
        { seed: 0xdec2, runs: 1_000 },
        (random) => {
          const json = JSON.parse(encodeDocument(anyDocument(random))) as Json;
          damage(random, json);
          return JSON.stringify(json);
        },
        (text) => {
          const decoded = decodeDocument(text);
          if (decoded.ok) {
            const again = decodeDocument(encodeDocument(decoded.value));
            expect(again).toStrictEqual(decoded);
            expect(decoded.value.elements.size).toBe(
              (JSON.parse(text) as { elements: unknown[] }).elements.length,
            );
          } else {
            expect(Object.keys(decoded)).toEqual(['ok', 'errors']);
            expect(decoded.errors.length).toBeGreaterThan(0);
          }
        },
      );
    },
  );

  it('REQ-P07 a cut-off document is one syntax error', () => {
    checkProperty(
      { seed: 0xdec3, runs: 300 },
      (random) => {
        const text = encodeDocument(anyDocument(random));
        return text.slice(0, randomInt(random, 0, text.length - 1));
      },
      (text) => {
        expect(decodeDocument(text)).toStrictEqual(refused('', 'syntax'));
      },
    );
  });
});
