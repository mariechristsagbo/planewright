import type { PointerInput, SaveStatus } from '@planewright/engine';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorProvider } from '../../src/editor/EditorProvider.tsx';
import { BUILD_STATUS } from '../../src/foundation.ts';
import type { StorageNotice } from '../../src/platform/storage.ts';
import { EmptyCanvasNote } from '../../src/shell/EmptyCanvasNote.tsx';
import { UNSAVED_NOTE } from '../../src/shell/empty-canvas-note.ts';
import { saveHarness } from '../support/saving.ts';

// The empty-canvas note (ADR 0012, D5, and the v0.2 plan's S2): over an empty canvas, the
// pre-release sentence that About this build holds, gone while anything is drawn or a text is
// edited. While nothing is saved in this browser, it leaves out the sentence's saving clause
// (issue #86).

const tapAt = (x: number, y: number): PointerInput[] =>
  (['pointer-down', 'pointer-up'] as const).map((type, index) => ({
    type,
    pointerId: 1,
    pointer: 'mouse',
    button: 'primary',
    at: { x, y },
    modifiers: { shift: false, alt: false, mod: false },
    time: 1_000 + index * 50,
  }));

const SAVED: SaveStatus = { type: 'saved' };

/** The note over an editor whose view reports a save status, saved unless the test says. */
function mount(save: SaveStatus | null = SAVED, storageNotice: StorageNotice | null = null) {
  const harness = saveHarness(save, storageNotice);
  harness.inner.resize({ width: 800, height: 600, pixelRatio: 1 });
  render(
    <EditorProvider surface={harness.surface}>
      <EmptyCanvasNote />
    </EditorProvider>,
  );
  return harness;
}

describe('the empty-canvas note', () => {
  it('D7 repeats the pre-release sentence while nothing is drawn', () => {
    mount();
    expect(screen.getByText(BUILD_STATUS)).toBeVisible();
  });

  it('D7 goes once an element exists, and comes back when none is left', () => {
    const { inner: editor } = mount();
    act(() => {
      editor.run('tool.rectangle');
      for (const event of tapAt(100, 100)) editor.input(event);
    });
    expect(editor.view.elements).toHaveLength(1);
    expect(screen.queryByText(BUILD_STATUS)).toBeNull();
    act(() => {
      editor.run('history.undo');
    });
    expect(screen.getByText(BUILD_STATUS)).toBeVisible();
  });

  it('D7 does not show while a new text is edited', () => {
    const { inner: editor } = mount();
    act(() => {
      editor.run('tool.text');
      for (const event of tapAt(100, 100)) editor.input(event);
    });
    expect(editor.view.text).not.toBeNull();
    expect(screen.queryByText(BUILD_STATUS)).toBeNull();
  });
});

describe('the empty-canvas note while nothing is saved in this browser', () => {
  it.each([
    [null, 'unavailable'],
    [{ type: 'failed', reason: 'quota' }, null],
    [{ type: 'stale' }, null],
  ] satisfies [SaveStatus | null, StorageNotice | null][])(
    'leaves out that the drawing is saved for %j with the start-up notice %s',
    (save, notice) => {
      mount(save, notice);
      expect(screen.getByText(UNSAVED_NOTE)).toBeVisible();
      expect(document.body).not.toHaveTextContent(/saved in (this|the) browser/u);
    },
  );

  it('keeps the pre-release sentence beside the unreadable-data notice while saving works', () => {
    mount(SAVED, 'invalid');
    expect(screen.getByText(BUILD_STATUS)).toBeVisible();
  });

  it('follows the save status: the saving clause only while saving works, pending included', () => {
    const { setSave } = mount({ type: 'failed', reason: 'unavailable' });
    expect(screen.getByText(UNSAVED_NOTE)).toBeVisible();
    setSave({ type: 'pending' });
    expect(screen.getByText(BUILD_STATUS)).toBeVisible();
    setSave(SAVED);
    expect(screen.getByText(BUILD_STATUS)).toBeVisible();
    setSave({ type: 'stale' });
    expect(screen.getByText(UNSAVED_NOTE)).toBeVisible();
    expect(screen.queryByText(BUILD_STATUS)).toBeNull();
  });

  it('shows no note while an element exists, whatever the status', () => {
    const { inner: editor } = mount(null, 'unavailable');
    act(() => {
      editor.run('tool.rectangle');
      for (const event of tapAt(100, 100)) editor.input(event);
    });
    expect(document.querySelector('.empty-canvas-note')).toBeNull();
    act(() => {
      editor.run('history.undo');
    });
    expect(screen.getByText(UNSAVED_NOTE)).toBeVisible();
  });
});
