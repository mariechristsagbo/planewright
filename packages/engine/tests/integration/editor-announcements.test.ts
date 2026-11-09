import { describe, expect, it } from 'vitest';

import { createEditor } from '../../src/editor/editor.ts';
import {
  announcingHarness,
  changed,
  recordingAnnouncer,
  selected,
} from '../support/announcements.ts';
import { DOCUMENT } from '../support/autosave.ts';
import { KEYS } from '../support/creation-input.ts';
import {
  createCountingIds,
  createFixedAdvanceMeasurer,
  createManualClock,
  createQueueScheduler,
} from '../support/fakes.ts';
import { keyEvent, move, wheelEvent } from '../support/inputs.ts';
import { tapper } from '../support/selection-input.ts';
import { ELLIPSE, RECTANGLE, TEXT, selectionDocument } from '../support/selection-scene.ts';
import { dragFrom } from '../support/transform-scene.ts';

// What the editor announces through the announcer port (docs/architecture/engine/quality.md#accessibility,
// REQ-Y04): the new selection count after each selection change, each change with its element
// count, and each undo and redo with its label and element count.

const arrow = (key: string, shift = false) => keyEvent('key-down', key, key, { shift });

describe('the editor’s announcements', () => {
  it('REQ-Y04 announces the new selection count after each selection change, and nothing when it stays', () => {
    const harness = announcingHarness(selectionDocument());
    const tap = tapper('mouse');
    harness.feed(...tap(200, 150), ...tap(450, 150, true));
    harness.feed(move(900, 600), wheelEvent({ x: 900, y: 600 }, { x: 0, y: 40 }));
    harness.feed(...tap(900, 650));
    harness.editor.select([TEXT]);
    harness.editor.select([TEXT]);
    expect(harness.said).toEqual([selected(1), selected(2), selected(0), selected(1)]);
  });

  it('REQ-Y04 announces each creation with its kind and the selection after it', () => {
    const harness = announcingHarness();
    const tap = tapper('mouse');
    harness.feed(KEYS.rectangle, ...tap(700, 500));
    harness.feed(KEYS.text, ...tap(800, 600));
    harness.editor.editText({ type: 'value', text: 'Hi' });
    harness.editor.editText({ type: 'commit' });
    harness.feed(KEYS.freehand, ...tap(300, 300));
    expect(harness.said).toEqual([
      changed('change', ['create', 1, 'rectangle', 1]),
      selected(0),
      changed('change', ['create', 1, 'text', 1]),
      selected(0),
      changed('change', ['create', 1, 'freehand', 0]),
    ]);
  });

  it('REQ-Y04 announces nudging, duplicating and deleting with their element counts', () => {
    const harness = announcingHarness(selectionDocument());
    const tap = tapper('mouse');
    harness.feed(...tap(200, 150), arrow('ArrowLeft'), ...tap(450, 150, true));
    harness.feed(keyEvent('key-down', 'd', 'KeyD', { mod: true }), arrow('ArrowRight', true));
    harness.feed(keyEvent('key-down', 'Delete', 'Delete'));
    expect(harness.said).toEqual([
      selected(1),
      changed('change', ['nudge', 1, 'rectangle', 1]),
      selected(2),
      changed('change', ['duplicate', 2, '', 2]),
      changed('change', ['nudge', 2, '', 2]),
      changed('change', ['delete', 2, '', 0]),
    ]);
  });

  it('REQ-Y04 announces each undo and redo of a move with its label and element count', () => {
    const harness = announcingHarness(selectionDocument());
    const tap = tapper('mouse');
    harness.feed(...tap(200, 150), ...tap(450, 150, true));
    const { start, to, end } = dragFrom('mouse', [200, 150, 240, 190]);
    harness.feed(...start, to, end, KEYS.undo, KEYS.redo);
    expect(harness.said.slice(2)).toEqual([
      changed('change', ['move', 2, '', 2]),
      changed('undo', ['move', 2, '', 2]),
      changed('redo', ['move', 2, '', 2]),
    ]);
  });

  it('REQ-Y04 names the kind of a lone element whose creation is undone and redone', () => {
    const harness = announcingHarness();
    harness.feed(KEYS.ellipse, ...tapper('touch')(600, 400), KEYS.undo, KEYS.redoY);
    expect(harness.said).toEqual([
      changed('change', ['create', 1, 'ellipse', 1]),
      changed('undo', ['create', 1, 'ellipse', 0]),
      changed('redo', ['create', 1, 'ellipse', 1]),
    ]);
  });

  it('REQ-Y04 says nothing of the selection that a stored document opens with', () => {
    const announcer = recordingAnnouncer();
    const clock = createManualClock();
    const ports = {
      clock,
      scheduler: createQueueScheduler(clock),
      ids: createCountingIds(),
      text: createFixedAdvanceMeasurer(),
      announcer,
    };
    const session = { camera: { x: 0, y: 0, zoom: 1 }, selection: [RECTANGLE] };
    const stored = { id: DOCUMENT, rev: 3, document: selectionDocument(), session };
    const editor = createEditor(ports, stored);
    expect(editor.view.selection).toEqual([RECTANGLE]);
    editor.select([RECTANGLE, ELLIPSE]);
    expect(announcer.said).toEqual([selected(2)]);
  });
});
