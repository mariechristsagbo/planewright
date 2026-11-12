import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// The tool bar as the phone's dock (ADR 0012, decisions 2 and 14; the v0.2 plan's S8, issue #73's
// D2, D3 and D11): on a phone in portrait the toolbar "Tools" holds the six tools that More does
// not hold, then More, with one tab stop that the arrow keys, Home and End move, and the stop is
// kept by command, so that a window that turns leaves exactly one stop and never the focus on the
// body.

const DOCK = ['Selection', 'Rectangle', 'Ellipse', 'Line', 'Freehand', 'Text', 'More'];

function mount(phone: boolean) {
  const turn = phoneQuery(phone);
  const harness = surfaceHarness();
  render(<EditorShell surface={harness.surface} />);
  const toolbar = () => screen.getByRole('toolbar', { name: 'Tools' });
  const button = (name: string) => within(toolbar()).getByRole('button', { name });
  return { ...harness, turn, toolbar, button };
}

/** The tool bar's buttons that take the Tab key, outside More's popover. */
const stops = (toolbar: HTMLElement): HTMLElement[] =>
  within(toolbar)
    .getAllByRole('button')
    .filter((button) => button.tabIndex === 0 && button.closest('#more-tools') === null);

const names = (toolbar: HTMLElement): (string | null)[] =>
  within(toolbar)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));

describe('the dock', () => {
  it('A2 D2 is the toolbar Tools with exactly seven buttons in order, no hairline, in the tools island', () => {
    const { toolbar, button } = mount(true);
    expect(names(toolbar())).toEqual(DOCK);
    expect(toolbar().querySelectorAll('.tool-divider')).toHaveLength(0);
    expect(toolbar().closest('[data-island]')).toHaveAttribute('data-island', 'tools');
    expect(button('Selection')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Rectangle')).toHaveAttribute('aria-keyshortcuts', 'R 2');
    expect(button('Rectangle')).toHaveAccessibleDescription(
      'Shortcuts R or 2. Drag to draw a rectangle; a tap draws a 100 by 100 one.',
    );
    expect(button('Text')).toHaveAttribute('data-chrome-tip', 'Text');
    expect(button('Line').querySelector('kbd')).toHaveTextContent('L');
  });

  it('A12 D2 has one tab stop that the arrow keys, Home and End move across the seven', () => {
    const { toolbar } = mount(true);
    const buttons = within(toolbar()).getAllByRole('button');
    expect(stops(toolbar())).toEqual([buttons[0]]);
    act(() => {
      buttons[0]?.focus();
    });
    const press = (key: string) => {
      fireEvent.keyDown(document.activeElement ?? toolbar(), { key });
      return document.activeElement;
    };
    expect(press('ArrowLeft')).toBe(buttons[6]);
    expect(press('ArrowRight')).toBe(buttons[0]);
    expect(press('End')).toBe(buttons[6]);
    expect(stops(toolbar())).toEqual([buttons[6]]);
    expect(press('Home')).toBe(buttons[0]);
    expect(press('ArrowDown')).toBe(buttons[1]);
    expect(press('ArrowUp')).toBe(buttons[0]);
    expect(stops(toolbar())).toEqual([buttons[0]]);
  });

  it('D3 More is named More, collapsed, controls an element that exists, and has no keys', () => {
    const { button } = mount(true);
    const more = button('More');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', 'more-tools');
    expect(document.getElementById('more-tools')).toHaveAttribute('hidden');
    expect(more).toHaveAttribute('aria-pressed', 'false');
    expect(more).not.toHaveAttribute('aria-keyshortcuts');
    expect(more.querySelector('kbd')).toBeNull();
    expect(more.querySelector('svg[data-glyph="more"]')).not.toBeNull();
    expect(more).toHaveAttribute('data-chrome-tip', 'More');
  });

  it('D1 the palette elsewhere: nine buttons, no More and no popover', () => {
    const { toolbar } = mount(false);
    expect(names(toolbar())).toEqual([
      'Hand',
      'Selection',
      'Rectangle',
      'Ellipse',
      'Diamond',
      'Line',
      'Freehand',
      'Text',
      'Tool lock',
    ]);
    expect(document.getElementById('more-tools')).toBeNull();
  });

  it('A12 D2 a window that turns keeps one stop: Tool lock focused on the palette gives Selection in the dock, focused', () => {
    const { toolbar, button, turn } = mount(false);
    act(() => {
      button('Tool lock').focus();
    });
    expect(stops(toolbar())).toEqual([button('Tool lock')]);
    turn(true);
    expect(stops(toolbar())).toEqual([button('Selection')]);
    expect(document.activeElement).toBe(button('Selection'));
  });

  it('A12 D2 turning back with More focused gives Hand, focused', () => {
    const { toolbar, button, turn } = mount(true);
    act(() => {
      button('More').focus();
    });
    expect(stops(toolbar())).toEqual([button('More')]);
    turn(false);
    expect(stops(toolbar())).toEqual([button('Hand')]);
    expect(document.activeElement).toBe(button('Hand'));
  });

  it('A3 A12 More closes when the window leaves the query, the focus never on the body', () => {
    const { toolbar, button, turn } = mount(true);
    act(() => {
      fireEvent.pointerDown(button('More'), { pointerType: 'touch' });
      fireEvent.click(button('More'));
    });
    const group = screen.getByRole('group', { name: 'More' });
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: 'Hand' }));
    turn(false);
    expect(document.activeElement).toBe(button('Hand'));
    expect(stops(toolbar())).toEqual([button('Hand')]);
    turn(true);
    expect(button('More')).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('more-tools')).toHaveAttribute('hidden');
    expect(stops(toolbar())).toEqual([button('Selection')]);
  });
});
