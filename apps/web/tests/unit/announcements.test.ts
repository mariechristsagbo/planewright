import type { AnnouncementKey, AnnouncementValues } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import {
  announceStorageNotice,
  messageOf,
  urgencyOf,
  webAnnouncer,
} from '../../src/a11y/announcements.ts';
import type { LiveRegion } from '../../src/a11y/live-region.ts';

// What the page says for each of the editor's announcements (REQ-Y04), in English, and how
// urgently: selection counts, changes, undo and redo politely; failed and stale saves and the
// start-up storage notices assertively.

const change = (action: string, count: number, kind: string, selected: number) => ({
  action,
  count,
  kind,
  selected,
});

/** A live region that keeps what it is asked to say. */
function recording() {
  const said: [string, string][] = [];
  const region: LiveRegion = {
    say: (text, urgency) => {
      said.push([text, urgency]);
    },
  };
  return { region, said };
}

describe('the announcements in English', () => {
  it.each([
    ['selection', { selected: 0 }, 'Nothing selected.'],
    ['selection', { selected: 1 }, '1 element selected.'],
    ['selection', { selected: 3 }, '3 elements selected.'],
    ['change', change('create', 1, 'rectangle', 1), 'Rectangle created. 1 element selected.'],
    ['change', change('create', 1, 'freehand', 0), 'Freehand stroke created. Nothing selected.'],
    ['change', change('nudge', 1, 'ellipse', 1), 'Nudged 1 ellipse. 1 element selected.'],
    ['change', change('move', 2, '', 2), 'Moved 2 elements. 2 elements selected.'],
    ['change', change('resize', 1, 'diamond', 1), 'Resized 1 diamond. 1 element selected.'],
    ['change', change('rotate', 1, 'line', 1), 'Rotated 1 line. 1 element selected.'],
    ['change', change('duplicate', 2, '', 2), 'Duplicated 2 elements. 2 elements selected.'],
    ['change', change('delete', 2, '', 0), 'Deleted 2 elements. Nothing selected.'],
    ['change', change('edit-text', 1, 'text', 1), 'Edited 1 text. 1 element selected.'],
    ['undo', change('move', 2, '', 2), 'Undid move of 2 elements. 2 elements selected.'],
    ['undo', change('create', 1, 'text', 0), 'Undid creation of 1 text. Nothing selected.'],
    [
      'redo',
      change('delete', 1, 'freehand', 0),
      'Redid deletion of 1 freehand stroke. Nothing selected.',
    ],
    ['redo', change('nudge', 3, '', 3), 'Redid nudge of 3 elements. 3 elements selected.'],
    [
      'undo',
      change('style', 1, 'rectangle', 1),
      'Undid change of 1 rectangle. 1 element selected.',
    ],
    [
      'save-failed',
      { reason: 'quota' },
      'Saving failed: the browser’s storage for this page is full. Your changes are kept in this tab, and saving is tried again.',
    ],
    [
      'save-stale',
      {},
      'Another tab saved a newer version of this drawing, so this tab stopped saving. Load the newer version, which drops this tab’s unsaved changes and its undo history, or keep this version, which replaces the other one.',
    ],
  ] satisfies [AnnouncementKey, AnnouncementValues, string][])(
    'REQ-Y04 says %s %o as “%s”',
    (key, values, text) => {
      expect(messageOf(key, values)).toBe(text);
    },
  );

  it('REQ-Y04 says failed and stale saves assertively and everything else politely', () => {
    const keys = ['selection', 'change', 'undo', 'redo', 'save-failed', 'save-stale'] as const;
    expect(keys.map(urgencyOf)).toEqual([
      'polite',
      'polite',
      'polite',
      'polite',
      'assertive',
      'assertive',
    ]);
  });

  it('REQ-Y04 hands the editor an announcer that writes into the live region', () => {
    const { region, said } = recording();
    const announcer = webAnnouncer(region);
    announcer.announce('selection', { selected: 2 });
    announcer.announce('save-failed', { reason: 'failed' });
    expect(said).toEqual([
      ['2 elements selected.', 'polite'],
      [
        'Saving failed: the browser’s storage did not take the change. Your changes are kept in this tab, and saving is tried again.',
        'assertive',
      ],
    ]);
  });

  it('REQ-P07 says the start-up storage notice assertively, and nothing without one', () => {
    const { region, said } = recording();
    announceStorageNotice(region, null);
    announceStorageNotice(region, 'unavailable');
    announceStorageNotice(region, 'invalid');
    expect(said).toEqual([
      [
        'Saving is unavailable in this browser: the drawing stays in this tab only and is lost when the tab closes.',
        'assertive',
      ],
      [
        'The drawing saved in this browser could not be read, so a new drawing was opened. The saved data is left unchanged.',
        'assertive',
      ],
    ]);
  });
});
