import type { IdSource } from '../ports/ports.ts';
import type { Brand } from './brand.ts';

/** 22 base64url characters: 128 random bits from the IdSource port. */
export type ElementId = Brand<string, 'ElementId'>;
/** The same form as an element identifier. */
export type GroupId = Brand<string, 'GroupId'>;
/** The same form as an element identifier, one per editor session. */
export type ClientId = Brand<string, 'ClientId'>;
/** 64 lower-case hexadecimal characters: the SHA-256 digest of a file's bytes. */
export type FileId = Brand<string, 'FileId'>;

// The form only: which 128 bits the 22 characters carry is the identifier source's concern.
const RANDOM_ID = /^[A-Za-z0-9_-]{22}$/;
const FILE_ID = /^[0-9a-f]{64}$/;

export const isElementId = (text: string): text is ElementId => RANDOM_ID.test(text);

export const isGroupId = (text: string): text is GroupId => RANDOM_ID.test(text);

export const isClientId = (text: string): text is ClientId => RANDOM_ID.test(text);

export const isFileId = (text: string): text is FileId => FILE_ID.test(text);

/** The source's next identifier, refused at once if it does not have the identifier form. */
function draw<T extends string>(ids: IdSource, accepts: (text: string) => text is T): T {
  const id = ids.next();
  if (accepts(id)) {
    return id;
  }
  throw new RangeError(
    `The identifier source returned ${JSON.stringify(id)}, not 22 base64url characters.`,
  );
}

/** A new element identifier, unique without coordination (REQ-K02). */
export const newElementId = (ids: IdSource): ElementId => draw(ids, isElementId);

export const newGroupId = (ids: IdSource): GroupId => draw(ids, isGroupId);

export const newClientId = (ids: IdSource): ClientId => draw(ids, isClientId);
