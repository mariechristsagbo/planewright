import { describe, expect, it } from 'vitest';

import { createEditor } from '../../src/editor/editor.ts';
import type { DocumentRepository, SaveResult } from '../../src/persistence/repository.ts';
import { changed, recordingAnnouncer } from '../support/announcements.ts';
import { settle } from '../support/autosave.ts';
import { KEYS } from '../support/creation-input.ts';
import { VIEWPORT } from '../support/editors.ts';
import {
  createCountingIds,
  createFixedAdvanceMeasurer,
  createManualClock,
  createQueueScheduler,
} from '../support/fakes.ts';
import { keyEvent } from '../support/inputs.ts';
import { tapper } from '../support/selection-input.ts';

// The assertive announcements of saving (docs/architecture/engine/quality.md#accessibility): a
// failed save, once per reason, and a save refused because another tab saved a newer version.

/** A repository that answers its saves in turn from a script, then accepts every save. */
function scripted(results: SaveResult[]): DocumentRepository {
  return {
    load: () => Promise.resolve({ type: 'empty' }),
    save: () => Promise.resolve(results.shift() ?? { ok: true, rev: 9 }),
  };
}

function savingAnnouncer(results: SaveResult[]) {
  const announcer = recordingAnnouncer();
  const clock = createManualClock();
  const scheduler = createQueueScheduler(clock);
  const ports = {
    clock,
    scheduler,
    ids: createCountingIds(),
    text: createFixedAdvanceMeasurer(),
    repository: scripted(results),
    announcer,
  };
  const editor = createEditor(ports);
  editor.resize(VIEWPORT);
  const advance = async (ms: number): Promise<void> => {
    scheduler.advance(ms);
    await settle();
  };
  return { editor, said: announcer.said, advance };
}

describe('the announcements of saving', () => {
  it('REQ-Y04 announces a failed save once per reason, and nothing while it is retried or once it succeeds', async () => {
    const { editor, said, advance } = savingAnnouncer([
      { ok: false, reason: 'quota' },
      { ok: false, reason: 'quota' },
      { ok: false, reason: 'failed' },
    ]);
    for (const event of [KEYS.rectangle, ...tapper('mouse')(600, 300)]) editor.input(event);
    await advance(300);
    await advance(1_000);
    expect(editor.view.save).toEqual({ type: 'failed', reason: 'quota' });
    await advance(2_000);
    await advance(4_000);
    expect(editor.view.save).toEqual({ type: 'saved' });
    expect(said).toEqual([
      changed('change', ['create', 1, 'rectangle', 1]),
      { key: 'save-failed', values: { reason: 'quota' } },
      { key: 'save-failed', values: { reason: 'failed' } },
    ]);
  });

  it('REQ-Y04 announces a save refused because another tab saved a newer version', async () => {
    const { editor, said, advance } = savingAnnouncer([
      { ok: false, reason: 'stale', storedRev: 4 },
    ]);
    for (const event of [KEYS.ellipse, ...tapper('mouse')(600, 300)]) editor.input(event);
    await advance(300);
    editor.input(keyEvent('key-down', 'ArrowUp', 'ArrowUp'));
    await advance(1_000);
    expect(editor.view.save).toEqual({ type: 'stale' });
    expect(said.slice(1)).toEqual([
      { key: 'save-stale', values: {} },
      changed('change', ['nudge', 1, 'ellipse', 1]),
    ]);
  });
});
