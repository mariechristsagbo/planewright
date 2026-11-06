/**
 * What the codec can report about an input. Each problem is a message key: the interface turns
 * it into text, so the engine never holds user-facing sentences.
 */
export const CODEC_PROBLEMS = [
  'too-large',
  'syntax',
  'not-object',
  'not-array',
  'not-string',
  'not-number',
  'not-integer',
  'not-boolean',
  'not-finite',
  'missing',
  'unknown-field',
  'unknown-value',
  'wrong-format',
  'invalid-schema',
  'newer-schema',
  'out-of-range',
  'too-long',
  'too-many',
  'too-few',
  'malformed-id',
  'malformed-file-id',
  'malformed-order-key',
  'malformed-color',
  'unsafe-link',
  'carriage-return',
  'not-normalised',
  'length-mismatch',
  'duplicate-id',
  'unknown-reference',
  'self-reference',
  'group-cycle',
] as const;

export type CodecProblem = (typeof CODEC_PROBLEMS)[number];

export interface CodecError {
  /** The JSON path of the offending value, for example "elements[3].style.stroke.width"; '' is the root. */
  readonly path: string;
  readonly problem: CodecProblem;
}

/** A whole value, or the errors and nothing else (REQ-P07). */
export type Decoded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly CodecError[] };
