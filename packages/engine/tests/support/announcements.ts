import type { AnnouncementKey, AnnouncementValues, Announcer } from '../../src/editor/announcer.ts';
import type { DocumentState } from '../../src/model/document.ts';
import { editorHarness } from './editors.ts';
import type { EditorHarness } from './editors.ts';

// A recording announcer (docs/architecture/engine/modules.md#ports): the announcer port's test
// fake, which keeps every announcement in order.

export interface Said {
  readonly key: AnnouncementKey;
  readonly values: AnnouncementValues;
}

export interface RecordingAnnouncer extends Announcer {
  readonly said: Said[];
}

export function recordingAnnouncer(): RecordingAnnouncer {
  const said: Said[] = [];
  return {
    said,
    announce: (key, values) => {
      said.push({ key, values });
    },
  };
}

/** An editor harness whose editor announces to a recording announcer. */
export function announcingHarness(document?: DocumentState): EditorHarness & { said: Said[] } {
  const announcer = recordingAnnouncer();
  return { ...editorHarness(document, { announcer }), said: announcer.said };
}

/** The selection announcement for a count. */
export const selected = (count: number): Said => ({
  key: 'selection',
  values: { selected: count },
});

/** A change, undo or redo announcement: the history label, the element count, the kind of a lone element. */
export function changed(
  key: 'change' | 'undo' | 'redo',
  [action, count, kind, selection]: readonly [string, number, string, number],
): Said {
  return { key, values: { action, count, kind, selected: selection } };
}
