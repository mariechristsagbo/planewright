import type { PointerInput } from '@planewright/engine';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUILD_STATUS } from '../../src/foundation.ts';
import { EmptyCanvasNote } from '../../src/shell/EmptyCanvasNote.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The empty-canvas note (ADR 0012, D5, and the v0.2 plan's S2): over an empty canvas, the
// pre-release sentence that About this build holds, gone while anything is drawn or a text is
// edited.

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

function mount() {
  const harness = surfaceHarness();
  harness.editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  render(harness.wrap(<EmptyCanvasNote />));
  return harness;
}

describe('the empty-canvas note', () => {
  it('D7 repeats the pre-release sentence while nothing is drawn', () => {
    mount();
    expect(screen.getByText(BUILD_STATUS)).toBeVisible();
  });

  it('D7 goes once an element exists, and comes back when none is left', () => {
    const { editor } = mount();
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
    const { editor } = mount();
    act(() => {
      editor.run('tool.text');
      for (const event of tapAt(100, 100)) editor.input(event);
    });
    expect(editor.view.text).not.toBeNull();
    expect(screen.queryByText(BUILD_STATUS)).toBeNull();
  });
});
