/**
 * The key of the brand that keeps identifiers, order keys and colours apart from plain strings
 * (docs/architecture/engine/domain-model.md). It is a real symbol, because the engine's boundary
 * refuses ambient declarations (ADR 0004); nothing reads it at run time.
 */
const brand: unique symbol = Symbol('brand');

/** A `T` that only the codec or the helper that checked it can create. */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
