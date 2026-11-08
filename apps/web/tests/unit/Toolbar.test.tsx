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
    ).toEqual([
      'HandH',
      'SelectionV or 1',
      'RectangleR or 2',
      'EllipseO or 3',
      'DiamondD or 4',
      'LineL or 5',
      'FreehandP or 6',
      'TextT or 7',
      'Tool lockQ',
    ]);
    expect(hand).toHaveAttribute('aria-pressed', 'false');
    expect(selection).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC REQ-C14 each tool exposes its shortcut in aria-keyshortcuts and its description', () => {
    const { hand, selection } = mount();
    expect(hand).toHaveAttribute('aria-keyshortcuts', 'H');
    expect(hand).toHaveAccessibleDescription('Shortcut H. Drag to pan the canvas.');
    expect(selection).toHaveAttribute('aria-keyshortcuts', 'V 1');
    expect(selection).toHaveAccessibleDescription(
      'Shortcuts V or 1. Selects, moves, resizes and rotates the drawn elements.',
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    const describe = (name: string) => within(toolbar).getByRole('button', { name });
    expect(describe('Rectangle')).toHaveAccessibleDescription(
      'Shortcuts R or 2. Drag to draw a rectangle; a tap draws a 100 by 100 one.',
    );
    expect(describe('Line')).toHaveAttribute('aria-keyshortcuts', 'L 5');
    expect(describe('Text')).toHaveAccessibleDescription(
      'Shortcuts T or 7. Tap to place a text and type it; Escape or a tap elsewhere ends it.',
    );
    expect(describe('Freehand')).toHaveAccessibleDescription(
      'Shortcuts P or 6. Drag to draw a freehand stroke; a tap draws a dot. The tool stays active.',
    );
  });

  it('REQ-C05 REQ-Y01 shows tool lock as a toggle whose state is pressed, never in its name', () => {
    const { toolbar, editor } = mount();
    const lock = within(toolbar).getByRole('button', { name: 'Tool lock' });
    expect(lock).toHaveAttribute('aria-pressed', 'false');
    expect(lock).toHaveAttribute('aria-keyshortcuts', 'Q');
    expect(lock).toHaveAccessibleDescription(
      'Shortcut Q. Keeps the rectangle, ellipse, diamond and line tools active after drawing, with nothing selected.',
    );
    fireEvent.click(lock);
    expect(editor.view.toolLock).toBe(true);
    expect(screen.getByRole('button', { name: 'Tool lock', pressed: true })).toBe(lock);
    expect(fireEvent.keyDown(lock, { key: 'q', code: 'KeyQ' })).toBe(false);
    expect(lock).toHaveAttribute('aria-pressed', 'false');
    expect(editor.view.tool).toBe('selection');
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
    const lock = within(toolbar).getByRole('button', { name: 'Tool lock' });
    expect(press('ArrowLeft')).toBe(hand);
    expect(press('ArrowLeft')).toBe(lock);
    expect(press('ArrowLeft')).toBe(within(toolbar).getByRole('button', { name: 'Text' }));
    expect(press('ArrowDown')).toBe(lock);
    expect(press('ArrowDown')).toBe(hand);
    expect(press('ArrowUp')).toBe(lock);
    expect(press('ArrowDown')).toBe(hand);
    expect(press('ArrowDown')).toBe(selection);
    expect(press('Home')).toBe(hand);
    expect(press('End')).toBe(lock);
    expect(press('ArrowRight')).toBe(hand);
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
