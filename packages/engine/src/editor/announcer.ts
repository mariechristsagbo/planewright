// The announcer port (docs/architecture/engine/modules.md#ports): how the editor tells assistive
// technology what changed (REQ-Y04). The editor makes every announcement and the interface says it
// in its own words, so an announcement is a key with values, never a sentence.

/**
 * What an announcement reports:
 *
 * - `selection`: the selection changed; `selected` is the new count.
 * - `change`: a change was made; `action` is its history label, `count` the elements it changed,
 *   `kind` their kind when it is one element and empty otherwise, and `selected` the count after it.
 * - `undo` and `redo`: an undo or redo, with the same values as `change`.
 * - `save-failed`: a save failed, for `reason`; said assertively, once per reason.
 * - `save-stale`: another tab saved a newer version, so saving stopped; said assertively.
 */
export type AnnouncementKey =
  'selection' | 'change' | 'undo' | 'redo' | 'save-failed' | 'save-stale';

export type AnnouncementValues = Readonly<Record<string, string | number>>;

/** Sends a message to assistive technology; the web app writes it into a live region. */
export interface Announcer {
  announce(message: AnnouncementKey, values: AnnouncementValues): void;
}
