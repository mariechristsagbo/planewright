/** Turns a document of one schema into the next; the caller writes the new schema number. */
export type Migration = (
  document: Readonly<Record<string, unknown>>,
) => Readonly<Record<string, unknown>>;

/**
 * `MIGRATIONS[n - 1]` turns schema n into schema n + 1, so the current schema is one more than
 * their number. Schema 1 needs none; a new kind or a changed meaning after the first release adds
 * one (ADR 0005).
 */
export const MIGRATIONS: readonly Migration[] = [];

/**
 * Applies the migrations from a document's schema on, one step at a time. The result is untrusted
 * like any input: the decoder checks it as a document of the current schema.
 */
export const migrate = (
  document: Readonly<Record<string, unknown>>,
  schema: number,
  migrations: readonly Migration[],
): Readonly<Record<string, unknown>> =>
  migrations
    .slice(schema - 1)
    .reduce((current, step, index) => ({ ...step(current), schema: schema + index + 1 }), document);
