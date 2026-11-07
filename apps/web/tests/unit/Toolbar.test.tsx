import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Toolbar } from '../../src/ui/Toolbar.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The tool bar (docs/architecture/engine/quality.md#accessibility): a toolbar with one tab stop and
// arrow-key movement, whose tools are toggle buttons exposing their shortcuts (REQ-C14, REQ-Y01,
// REQ-Y03).

function mount() {
  const harness = surfaceHarness();
  render(harness.wrap(<Toolbar />));
  const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
  const hand = within(toolbar).getByRole('button', { name: 'Hand' });
  const selection = within(toolbar).getByRole('button', { name: 'Selection' });
  return { ...harness, toolbar, hand, selection };
}

describe('the tool bar', () => {
  it('AC REQ-Y01 REQ-Y03 is a toolbar named Tools whose tools are named toggle buttons', () => {
    const { toolbar, hand, selection } = mount();
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['HandH', 'SelectionV or 1']);
    expect(hand).toHaveAttribute('aria-pressed', 'false');
    expect(selection).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC REQ-C14 each tool exposes its shortcut in aria-keyshortcuts and its description', () => {
    const { hand, selection } = mount();
    expect(hand).toHaveAttribute('aria-keyshortcuts', 'H');
    expect(hand).toHaveAccessibleDescription('Shortcut H. Drag to pan the canvas.');
    expect(selection).toHaveAttribute('aria-keyshortcuts', 'V 1');
    expect(selection).toHaveAccessibleDescription(
      'Shortcuts V or 1. Selects elements; nothing can be drawn yet, so there is nothing to select.',
    );
  });

  it('REQ-Y01 shows the chosen tool as a pressed state and never in its name', () => {
    const { hand, selection, editor } = mount();
    fireEvent.click(hand);
    expect(editor.view.tool).toBe('hand');
    expect(screen.getByRole('button', { name: 'Hand', pressed: true })).toBe(hand);
    expect(selection).toHaveAttribute('aria-pressed', 'false');
  });

  it('AC REQ-Y03 has one tab stop that the arrow keys, Home and End move', () => {
    const { toolbar, hand, selection } = mount();
    expect([hand.tabIndex, selection.tabIndex]).toEqual([0, -1]);
    act(() => {
      hand.focus();
    });
    const press = (key: string) => {
      fireEvent.keyDown(document.activeElement ?? toolbar, { key });
      return document.activeElement;
    };
    expect(press('ArrowRight')).toBe(selection);
    expect([hand.tabIndex, selection.tabIndex]).toEqual([-1, 0]);
    expect(press('ArrowRight')).toBe(hand);
    expect(press('ArrowLeft')).toBe(selection);
    expect(press('ArrowUp')).toBe(hand);
    expect(press('ArrowDown')).toBe(selection);
    expect(press('Home')).toBe(hand);
    expect(press('End')).toBe(selection);
  });

  it('runs shortcuts pressed in it and prevents only their default, leaving Space to the button', () => {
    const { hand, editor } = mount();
    expect(fireEvent.keyDown(hand, { key: 'h', code: 'KeyH' })).toBe(false);
    expect(editor.view.tool).toBe('hand');
    expect(fireEvent.keyDown(hand, { key: '=', code: 'Equal', ctrlKey: true })).toBe(false);
    expect(editor.view.camera.zoom).toBeCloseTo(1.1, 9);
    expect(fireEvent.keyDown(hand, { key: ' ', code: 'Space' })).toBe(true);
    expect(fireEvent.keyUp(hand, { key: ' ', code: 'Space' })).toBe(true);
  });
});
