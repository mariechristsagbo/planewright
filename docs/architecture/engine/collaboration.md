# Collaboration-ready interfaces

Planewright does not implement collaboration in P0. This document lists what the P0 engine must
already guarantee so that collaboration can be added later without reworking it, and the types it
exports for that purpose ([ADR 0010](../../adr/0010-collaboration-ready-change-model.md)).

## Guarantees the P0 engine keeps

| Guarantee                                                                                       | Where it is specified                                                          | Requirements |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| Every change goes through `SceneStore.apply` with an origin; only `local` changes enter history | [scene and viewport](scene-and-viewport.md#change-sets), [history](history.md) | REQ-K01      |
| Change sets are plain JSON data with an author and a per-author sequence number                 | [scene and viewport](scene-and-viewport.md#change-sets)                        | REQ-K01      |
| Identifiers are random and unique without coordination                                          | [domain model](domain-model.md#identifiers-and-primitive-types)                | REQ-K02      |
| Drawing order is by order keys with an identifier tie-break, never by array position            | [domain model](domain-model.md#drawing-order)                                  | REQ-K02      |
| Relations have one owner: attachments on the connector, membership on the element               | [domain model](domain-model.md#elements)                                       | REQ-K02      |
| Each element and the document carry revisions                                                   | [domain model](domain-model.md#elements)                                       | REQ-K01      |
| Undo never overwrites a field another origin changed since                                      | [history](history.md#conflict-safe-undo)                                       | REQ-K03      |
| Selection, camera and tool live outside the document                                            | [domain model](domain-model.md#elements)                                       | REQ-K01      |
| The same validating decoder accepts files, the clipboard and, later, remote change sets         | [persistence](persistence.md#the-codec-boundary)                               | REQ-K01      |

## Exported types, without implementation

```ts
export interface PresenceState {
  readonly client: ClientId;
  readonly name: string;
  readonly color: Color;
  readonly pointer?: Point; // scene space
  readonly selection: readonly ElementId[];
}

export interface SyncPort {
  /** Send a committed local change set. */
  send(changes: ChangeSet): void;
  /** Receive change sets from other clients, to apply with the `remote` origin. */
  onRemote(listener: (changes: ChangeSet) => void): Cancel;
  sendPresence(state: PresenceState): void;
  onPresence(listener: (peers: readonly PresenceState[]) => void): Cancel;
}
```

`createEditor` does not accept a sync port in P0. The types exist so that the protocol package can
be designed against them.

## Left to the collaboration decision

A later issue, with its own investigation where the baseline is silent and its own ADR, decides:

- the merge policy for concurrent edits to one element: per element or per field, last writer wins
  with a deterministic tie-break, or a CRDT;
- the transport between clients and `apps/collab`, and the protocol messages that wrap change sets
  and presence;
- end-to-end encryption, with the room key kept in the URL fragment and out of every request
  (REQ-K04);
- room creation, joining, leaving and stopping (R-55), late joiners' first snapshot, server-side
  persistence of encrypted rooms, and reconnection after going offline (B-44, R-57);
- how undo behaves for changes that were merged with remote ones beyond the field rule above.

## Requirements served

REQ-K01 to REQ-K04.
