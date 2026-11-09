import type { AnnouncementKey, AnnouncementValues, Announcer } from '@planewright/engine';

import type { StorageNotice } from '../platform/storage.ts';
import { STALE_TEXT, STORAGE_NOTICE_TEXTS, failedText, isSaveFailure } from '../ui/notices.ts';
import type { LiveRegion, Urgency } from './live-region.ts';
import { kindName } from './names.ts';

// The editor's announcements in English (docs/architecture/engine/quality.md#accessibility,
// REQ-Y04): the engine sends a key with values, and the page says it in its own words, as
// docs/architecture/engine/history.md#availability writes an undo: "Undid move of 2 elements".

/** What a change did, after "Moved", "Deleted"…, for each history label P0 makes. */
const VERBS: Readonly<Record<string, string>> = {
  move: 'Moved',
  nudge: 'Nudged',
  resize: 'Resized',
  rotate: 'Rotated',
  duplicate: 'Duplicated',
  delete: 'Deleted',
  'edit-text': 'Edited',
};

/** What an undo or redo reverses or repeats, as in "Undid move of 2 elements". */
const NOUNS: Readonly<Record<string, string>> = {
  create: 'creation',
  move: 'move',
  nudge: 'nudge',
  resize: 'resize',
  rotate: 'rotation',
  duplicate: 'duplication',
  delete: 'deletion',
  'edit-text': 'text edit',
};

const numberOf = (values: AnnouncementValues, name: string): number => {
  const value = values[name];
  return typeof value === 'number' ? value : 0;
};

const textOf = (values: AnnouncementValues, name: string): string => String(values[name] ?? '');

/** "Nothing selected.", "1 element selected." or "3 elements selected." */
function selectedText(count: number): string {
  if (count === 0) return 'Nothing selected.';
  return count === 1 ? '1 element selected.' : `${String(count)} elements selected.`;
}

/** "1 rectangle" for a lone element of a known kind, otherwise "2 elements" or "1 element". */
function elementsText(count: number, kind: string): string {
  const name = kindName(kind);
  if (count === 1 && name !== undefined) return `1 ${name.toLowerCase()}`;
  return count === 1 ? '1 element' : `${String(count)} elements`;
}

function changeText(values: AnnouncementValues): string {
  const [action, kind, count] = [
    textOf(values, 'action'),
    textOf(values, 'kind'),
    numberOf(values, 'count'),
  ];
  const name = kindName(kind);
  if (action === 'create') {
    return count === 1 && name !== undefined
      ? `${name} created.`
      : `${elementsText(count, kind)} created.`;
  }
  return `${VERBS[action] ?? 'Changed'} ${elementsText(count, kind)}.`;
}

function historyText(key: 'undo' | 'redo', values: AnnouncementValues): string {
  const noun = NOUNS[textOf(values, 'action')] ?? 'change';
  const elements = elementsText(numberOf(values, 'count'), textOf(values, 'kind'));
  return `${key === 'undo' ? 'Undid' : 'Redid'} ${noun} of ${elements}.`;
}

/** The sentence that says an announcement. */
export function messageOf(key: AnnouncementKey, values: AnnouncementValues): string {
  const selected = selectedText(numberOf(values, 'selected'));
  switch (key) {
    case 'selection':
      return selected;
    case 'change':
      return `${changeText(values)} ${selected}`;
    case 'undo':
    case 'redo':
      return `${historyText(key, values)} ${selected}`;
    case 'save-failed': {
      const { reason } = values;
      return failedText(isSaveFailure(reason) ? reason : 'failed');
    }
    case 'save-stale':
      return STALE_TEXT;
  }
}

/** Failed and stale saves interrupt; everything else waits its turn. */
export const urgencyOf = (key: AnnouncementKey): Urgency =>
  key === 'save-failed' || key === 'save-stale' ? 'assertive' : 'polite';

/** The editor's announcer port over the page's live region. */
export const webAnnouncer = (region: LiveRegion): Announcer => ({
  announce(key, values) {
    region.say(messageOf(key, values), urgencyOf(key));
  },
});

/** Says why storage opened no drawing at start-up, once the page is shown, if it did not. */
export function announceStorageNotice(region: LiveRegion, notice: StorageNotice | null): void {
  if (notice !== null) region.say(STORAGE_NOTICE_TEXTS[notice], 'assertive');
}
