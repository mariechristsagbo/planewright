import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { CANVAS_ID } from '../../src/a11y/focus.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// More on the phone's dock (ADR 0012, decisions 2, 13 and 14; the v0.2 plan's S8, issue #73's D3):
// a press, Enter or Space opens its popover with the focus on Hand; its group, named More, holds
// Hand, Diamond and Tool lock as the palette's buttons; the arrow keys, Home and End move through
// them alone; pressing one runs its command and closes More with the focus on it, as Escape does
// without going further; the focus leaving it, a press outside it and a sheet opening close it; it
// is closed at every mount and stored nowhere.

function mount() {
  const turn = phoneQuery(true);
  const harness = surfaceHarness();
  harness.editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  render(<EditorShell surface={harness.surface} />);
  act(() => {
    harness.editor.run('tool.rectangle');
    harness.editor.run('canvas.enter');
  });
  /** A tap: a touch press then a click, so that the focus it moves opens no tooltip (S3). */
  const click = (element: HTMLElement): void => {
    act(() => {
      fireEvent.pointerDown(element, { pointerType: 'touch' });
      fireEvent.click(element);
    });
  };
  const toolbar = () => screen.getByRole('toolbar', { name: 'Tools' });
  const more = () => within(toolbar()).getByRole('button', { name: 'More' });
  const item = (name: string) =>
    within(screen.getByRole('group', { name: 'More' })).getByRole('button', { name });
  return { ...harness, turn, click, toolbar, more, item };
}

const popover = (): HTMLElement | null => document.getElementById('more-tools');

/** Presses a key on the focused element, and gives the element focused after it. */
function press(key: string): Element | null {
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key });
  });
  return document.activeElement;
}

describe('More', () => {
  it('D3 A3 a press opens it with the focus on Hand; its group, named More, holds the palette’s three toggle buttons', () => {
    const { click, more, item } = mount();
    click(more());
    expect(more()).toHaveAttribute('aria-expanded', 'true');
    expect(popover()).not.toHaveAttribute('hidden');
    const buttons = within(screen.getByRole('group', { name: 'More' })).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Hand',
      'Diamond',
      'Tool lock',
    ]);
    expect(document.activeElement).toBe(item('Hand'));
    expect(
      buttons.map((button) => [
        button.getAttribute('aria-pressed'),
        button.getAttribute('aria-keyshortcuts'),
      ]),
    ).toEqual([
      ['false', 'H'],
      ['false', 'D 4'],
      ['false', 'Q'],
    ]);
    expect(item('Hand')).toHaveAccessibleDescription('Shortcut H. Drag to pan the canvas.');
    expect(item('Diamond')).toHaveAccessibleDescription(
      'Shortcuts D or 4. Drag to draw a diamond; a tap draws a 100 by 100 one.',
    );
    expect(item('Tool lock')).toHaveAccessibleDescription(
      'Shortcut Q. Keeps the rectangle, ellipse, diamond and line tools active after drawing, with nothing selected.',
    );
    expect(item('Tool lock').querySelector('svg[data-glyph="lock-open"]')).not.toBeNull();
  });

  it.each(['Enter', ' '])(
    'D3 leaves %j to More, whose press then opens it with the focus on Hand',
    (key) => {
      const { more, item } = mount();
      act(() => {
        more().focus();
      });
      expect(fireEvent.keyDown(more(), { key })).toBe(true);
      act(() => {
        fireEvent.click(more());
      });
      expect(document.activeElement).toBe(item('Hand'));
    },
  );

  it('D3 the arrow keys wrap, and Home and End go to the ends, among the items alone', () => {
    const { click, more, item, toolbar } = mount();
    click(more());
    expect(press('ArrowRight')).toBe(item('Diamond'));
    expect(press('ArrowDown')).toBe(item('Tool lock'));
    expect(press('ArrowRight')).toBe(item('Hand'));
    expect(press('ArrowLeft')).toBe(item('Tool lock'));
    expect(press('ArrowUp')).toBe(item('Diamond'));
    expect(press('Home')).toBe(item('Hand'));
    expect(press('End')).toBe(item('Tool lock'));
    expect(item('Tool lock')).toHaveAttribute('tabindex', '0');
    // The dock's stop is still its first button.
    const dockStops = within(toolbar())
      .getAllByRole('button')
      .filter((button) => button.tabIndex === 0 && popover()?.contains(button) !== true);
    expect(dockStops.map((button) => button.getAttribute('aria-label'))).toEqual(['Selection']);
  });

  it('D3 Escape closes it with the focus on More, and goes no further: the tool and the selection stay', () => {
    const { click, more, item, editor } = mount();
    const { selection } = editor.view;
    expect(selection).toHaveLength(1);
    click(more());
    press('ArrowRight');
    // The arrow key's focus shows Diamond's tip at once, and the Escape that closes a tip does
    // nothing else (S3); the next one closes More.
    expect(screen.getByRole('tooltip')).toHaveTextContent('Diamond');
    expect(press('Escape')).toBe(item('Diamond'));
    expect(more()).toHaveAttribute('aria-expanded', 'true');
    expect(press('Escape')).toBe(more());
    expect(more()).toHaveAttribute('aria-expanded', 'false');
    expect(popover()).toHaveAttribute('hidden');
    expect([editor.view.tool, editor.view.selection]).toEqual(['selection', selection]);
  });

  it('D3 A4 pressing Diamond runs its command through editor.run and closes More, focused, showing the diamond pressed', () => {
    const { click, more, item, editor } = mount();
    const run = vi.spyOn(editor, 'run');
    click(more());
    click(item('Diamond'));
    expect(run.mock.calls).toEqual([['tool.diamond']]);
    expect(editor.view.tool).toBe('diamond');
    expect(more()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(more());
    expect(more()).toHaveAttribute('aria-pressed', 'true');
    expect(more().querySelector('svg[data-glyph="diamond"]')).not.toBeNull();
  });

  it('D3 A4 Tool lock toggles its padlock and state and leaves More’s glyph; Hand takes it and Selection gives it back', () => {
    const { click, more, item, editor, toolbar } = mount();
    click(more());
    click(item('Tool lock'));
    expect(editor.view.toolLock).toBe(true);
    expect([
      more().getAttribute('aria-pressed'),
      more().querySelector('svg')?.dataset['glyph'],
    ]).toEqual(['false', 'more']);
    click(more());
    expect(item('Tool lock')).toHaveAttribute('aria-pressed', 'true');
    expect(item('Tool lock').querySelector('svg[data-glyph="lock-closed"]')).not.toBeNull();
    click(item('Hand'));
    expect([
      more().getAttribute('aria-pressed'),
      more().querySelector('svg')?.dataset['glyph'],
    ]).toEqual(['true', 'hand']);
    click(within(toolbar()).getByRole('button', { name: 'Selection' }));
    expect([
      more().getAttribute('aria-pressed'),
      more().querySelector('svg')?.dataset['glyph'],
    ]).toEqual(['false', 'more']);
    expect(editor.view.toolLock).toBe(true);
  });

  it('D3 closes when the focus leaves it, on a press outside it with the focus kept off the body, and when a sheet opens', () => {
    const { click, more, toolbar } = mount();
    click(more());
    act(() => {
      document.getElementById(CANVAS_ID)?.focus();
    });
    expect(more()).toHaveAttribute('aria-expanded', 'false');
    click(more());
    act(() => {
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Undo' }), { pointerType: 'touch' });
    });
    expect(more()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(
      within(toolbar()).getByRole('button', { name: 'Selection' }),
    );
    click(more());
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Elements/u }));
    });
    expect(more()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('listbox', { name: 'Elements' })).toBeInTheDocument();
  });

  it('D3 a press inside the popover keeps it open', () => {
    const { click, more } = mount();
    click(more());
    const group = popover();
    if (group === null) throw new Error('No popover.');
    act(() => {
      fireEvent.pointerDown(group, { pointerType: 'touch' });
    });
    expect(fireEvent.mouseDown(group)).toBe(false);
    expect(more()).toHaveAttribute('aria-expanded', 'true');
  });

  it('A14 is closed at every mount, and opening or closing it writes nothing to storage', () => {
    const written = vi.spyOn(Storage.prototype, 'setItem');
    onTestFinished(() => {
      written.mockRestore();
    });
    const first = mount();
    first.click(first.more());
    expect(first.more()).toHaveAttribute('aria-expanded', 'true');
    cleanup();
    const second = mount();
    expect(second.more()).toHaveAttribute('aria-expanded', 'false');
    expect(popover()).toHaveAttribute('hidden');
    expect([written.mock.calls, localStorage.length, sessionStorage.length]).toEqual([[], 0, 0]);
  });
});
