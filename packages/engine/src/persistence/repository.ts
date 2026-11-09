import type { Camera } from '../camera/camera.ts';
import type { Brand } from '../model/brand.ts';
import type { CodecError } from '../model/codec.ts';
import type { CanvasState, DocumentState, GroupRecord } from '../model/document.ts';
import type { Element } from '../model/elements.ts';
import type { ElementId, GroupId } from '../model/ids.ts';
import type { IdSource } from '../ports/ports.ts';

// The document repository port (docs/architecture/engine/persistence.md#repository-port): the
// engine loads and saves documents only through it. The repository, not the editor, assigns every
// stored revision, so another tab's newer document is never overwritten silently (REQ-P06).

/** The same form as an element identifier: one per stored document. */
export type DocumentId = Brand<string, 'DocumentId'>;

const RANDOM_ID = /^[A-Za-z0-9_-]{22}$/;

export const isDocumentId = (text: string): text is DocumentId => RANDOM_ID.test(text);

/** A new document identifier, refused at once if the source's has not the identifier form. */
export function newDocumentId(ids: IdSource): DocumentId {
  const id = ids.next();
  if (isDocumentId(id)) return id;
  throw new RangeError(
    `The identifier source returned ${JSON.stringify(id)}, not 22 base64url characters.`,
  );
}

/** What a reload restores beside the document: never a history entry, never a new revision. */
export interface SessionState {
  readonly camera: Camera;
  readonly selection: readonly ElementId[];
}

export interface StoredDocument {
  readonly id: DocumentId;
  /** The stored revision, assigned by the repository; 0 for a document with no record yet. */
  readonly rev: number;
  readonly document: DocumentState;
  readonly session: SessionState;
}

export type LoadResult =
  | { readonly type: 'empty' }
  | { readonly type: 'loaded'; readonly stored: StoredDocument }
  /** The stored data failed the codec; it is left as it is. */
  | { readonly type: 'invalid'; readonly errors: readonly CodecError[] }
  /** Storage cannot be opened, as in private modes or with storage disabled. */
  | { readonly type: 'unavailable' };

/** The changes since the last save: the changed elements and groups as they are now. */
export interface DocumentDelta {
  readonly upserts: readonly Element[];
  readonly removals: readonly ElementId[];
  readonly groups: {
    readonly upserts: readonly GroupRecord[];
    readonly removals: readonly GroupId[];
  };
  readonly canvas: CanvasState;
}

export type SaveRequest =
  | {
      /** The changes since the last save. */
      readonly type: 'delta';
      readonly id: DocumentId;
      /** The stored revision this editor last loaded or wrote. */
      readonly baseRev: number;
      readonly delta: DocumentDelta;
      readonly session: SessionState;
    }
  | {
      /** The whole document, written over the stored one when the user keeps this version. */
      readonly type: 'replace';
      readonly id: DocumentId;
      /** The stored revision that the refused save reported. */
      readonly baseRev: number;
      readonly document: DocumentState;
      readonly session: SessionState;
    }
  | {
      /** Camera and selection only: no revision check and no new revision. */
      readonly type: 'session';
      readonly id: DocumentId;
      readonly session: SessionState;
    };

/** Why a save failed: storage full, storage gone, or anything else. */
export type SaveFailure = 'quota' | 'unavailable' | 'failed';

export type SaveResult =
  /** `rev` is the stored revision after the save. */
  | { readonly ok: true; readonly rev: number }
  | { readonly ok: false; readonly reason: 'stale'; readonly storedRev: number }
  | { readonly ok: false; readonly reason: SaveFailure };

export interface DocumentRepository {
  /** The most recently updated document. */
  load(): Promise<LoadResult>;
  save(request: SaveRequest): Promise<SaveResult>;
}
