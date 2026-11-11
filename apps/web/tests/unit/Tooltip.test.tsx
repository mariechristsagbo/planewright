import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { hoverDelay } from '../../src/shell/tooltip/tooltip-events.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The chrome's tooltips (ADR 0012 and the v0.2 plan's S3): delegated listeners on the shell's root
// open a control's tip after 500 ms of hover, at once on keyboard focus and never on touch; Escape,
// a press and leaving the control close it. The tip repeats the control's name and keys, which its
// name, aria-keyshortcuts and description already give, so it is never the only place of either,
// and the control keeps its own name and description.

const mount = () => render(<EditorShell surface={surfaceHarness().surface} />);
const tip = (): HTMLElement | null => screen.queryByRole('tooltip');
const button = (name: string | RegExp): HTMLElement => screen.getByRole('button', { name });

/** What the open tip says: the control's name, then its keys. */
function said(): { name: string; keys: string[] } | null {
  const shown = tip();
  if (shown === null) return null;
  const keys = within(shown)
    .queryAllByText(/./u, { selector: 'kbd' })
    .map((key) => key.textContent);
  return { name: shown.querySelector('.chrome-tip-name')?.textContent ?? '', keys };
}

const wait = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const focus = (element: HTMLElement): void => {
  act(() => {
    element.focus();
  });
};

/** The controls that show a glyph, or Reset zoom's zoom, in place of their name. */
const TIPPED = [
  'Planewright menu',
  'Hand',
  'Selection',
  'Rectangle',
  'Ellipse',
  'Diamond',
  'Line',
  'Freehand',
  'Text',
  'Tool lock',
  'Undo',
  'Redo',
  'Zoom out',
  'Reset zoom, 100%',
  'Zoom in',
  'Zoom to fit',
  'Keyboard shortcuts',
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the tooltips', () => {
  it('D4 delegate to one listener on the shell’s root for each pointer and focus event, and one on its document for the keys', () => {
    const listen = vi.spyOn(EventTarget.prototype, 'addEventListener');
    mount();
    const main = screen.getByRole('main');
    const calls = listen.mock.calls.map(([type], index) => [type, listen.mock.contexts[index]]);
    listen.mockRestore();
    for (const type of ['pointerover', 'pointerout', 'pointerdown', 'focusin', 'focusout']) {
      expect(calls.filter(([each, at]) => each === type && at === main)).toHaveLength(1);
    }
    expect(calls.filter(([each, at]) => each === 'keydown' && at === document)).toHaveLength(1);
    const buttons = new Set<unknown>(screen.getAllByRole('button'));
    expect(calls.filter(([, at]) => buttons.has(at))).toEqual([]);
  });

  it('D4 A6 open after 500 ms of mouse hover and close when the pointer leaves the control', () => {
    mount();
    const rectangle = button('Rectangle');
    fireEvent.pointerOver(rectangle, { pointerType: 'mouse' });
    wait(499);
    expect(tip()).toBeNull();
    wait(1);
    expect(said()).toEqual({ name: 'Rectangle', keys: ['R', '2'] });
    fireEvent.pointerOut(rectangle, {
      pointerType: 'mouse',
      relatedTarget: rectangle.querySelector('svg'),
    });
    expect(said()).toEqual({ name: 'Rectangle', keys: ['R', '2'] });
    fireEvent.pointerOut(rectangle, { pointerType: 'mouse', relatedTarget: document.body });
    expect(tip()).toBeNull();
    const ellipse = button('Ellipse');
    fireEvent.pointerOver(ellipse, { pointerType: 'mouse' });
    wait(300);
    fireEvent.pointerOut(ellipse, { pointerType: 'mouse', relatedTarget: document.body });
    wait(500);
    expect(tip()).toBeNull();
  });

  it('D4 A6 stay open while the pointer is over the control or its tip, and close when it leaves both', () => {
    mount();
    const rectangle = button('Rectangle');
    const shown = document.getElementById('chrome-tip');
    if (shown === null) throw new Error('No tip in the shell.');
    const move = (from: Element, to: Element): void => {
      fireEvent.pointerOut(from, { pointerType: 'mouse', relatedTarget: to });
      fireEvent.pointerOver(to, { pointerType: 'mouse', relatedTarget: from });
    };
    fireEvent.pointerOver(rectangle, { pointerType: 'mouse' });
    wait(500);
    move(rectangle, shown);
    const key = shown.querySelector('kbd') ?? shown;
    move(shown, key);
    wait(1000);
    expect(said()).toEqual({ name: 'Rectangle', keys: ['R', '2'] });
    move(key, rectangle);
    move(rectangle, shown);
    expect(said()?.name).toBe('Rectangle');
    // The tip is out of the tab order, and a press on it closes it.
    expect(shown.querySelectorAll('[tabindex], a, button, input, textarea')).toHaveLength(0);
    expect(shown).not.toHaveAttribute('tabindex');
    fireEvent.pointerDown(shown, { pointerType: 'mouse' });
    expect(tip()).toBeNull();
    move(shown, rectangle);
    move(rectangle, document.body);
    fireEvent.pointerOver(rectangle, { pointerType: 'mouse' });
    wait(500);
    move(rectangle, shown);
    move(shown, document.body);
    expect(tip()).toBeNull();
  });

  it('D4 A6 open at once on keyboard focus, follow the arrow keys, and close on Escape with the focus kept', () => {
    mount();
    const hand = button('Hand');
    focus(hand);
    expect(said()).toEqual({ name: 'Hand', keys: ['H'] });
    fireEvent.keyDown(hand, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(button('Selection')).toHaveFocus();
    expect(said()).toEqual({ name: 'Selection', keys: ['V', '1'] });
    fireEvent.keyDown(button('Selection'), { key: 'Escape', code: 'Escape' });
    expect(tip()).toBeNull();
    expect(button('Selection')).toHaveFocus();
    focus(button('Undo'));
    expect(said()).toEqual({ name: 'Undo', keys: ['Ctrl+Z'] });
    act(() => {
      button('Undo').blur();
    });
    expect(tip()).toBeNull();
  });

  it('D4 A6 stop the Escape that closes a showing tip there, so that only the next one reaches the editor', () => {
    mount();
    const rectangle = button('Rectangle');
    const reached = vi.fn();
    rectangle.addEventListener('keydown', reached);
    fireEvent.click(rectangle);
    focus(rectangle);
    expect(said()?.name).toBe('Rectangle');
    expect(fireEvent.keyDown(rectangle, { key: 'Escape', code: 'Escape' })).toBe(false);
    expect(tip()).toBeNull();
    expect(reached).not.toHaveBeenCalled();
    expect(rectangle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(rectangle, { key: 'Escape', code: 'Escape' });
    expect(reached).toHaveBeenCalledTimes(1);
    expect(rectangle).toHaveAttribute('aria-pressed', 'false');
    expect(button('Selection')).toHaveAttribute('aria-pressed', 'true');
    // While a hover tip only waits, no tip shows, and Escape goes on to the editor as before.
    fireEvent.click(rectangle);
    fireEvent.pointerOver(button('Line'), { pointerType: 'mouse' });
    wait(300);
    fireEvent.keyDown(rectangle, { key: 'Escape', code: 'Escape' });
    expect(reached).toHaveBeenCalledTimes(2);
    expect(rectangle).toHaveAttribute('aria-pressed', 'false');
    wait(500);
    expect(tip()).toBeNull();
  });

  it('D4 A6 keep closed after Escape only the tip of the control under the pointer, until the pointer leaves it', () => {
    mount();
    const hand = button('Hand');
    focus(hand);
    fireEvent.keyDown(hand, { key: 'Escape', code: 'Escape' });
    expect(tip()).toBeNull();
    // The pointer was elsewhere: Hand's hover tip opens as ever.
    fireEvent.pointerOver(hand, { pointerType: 'mouse' });
    wait(500);
    expect(said()?.name).toBe('Hand');
    fireEvent.keyDown(hand, { key: 'Escape', code: 'Escape' });
    fireEvent.pointerOver(hand.querySelector('svg') ?? hand, { pointerType: 'mouse' });
    wait(1000);
    expect(tip()).toBeNull();
    fireEvent.pointerOut(hand, { pointerType: 'mouse', relatedTarget: document.body });
    // A focus tip shows while the pointer waits on Line: Escape keeps Line's tip closed instead.
    const line = button('Line');
    focus(button('Undo'));
    fireEvent.pointerOver(line, { pointerType: 'mouse' });
    wait(300);
    fireEvent.keyDown(button('Undo'), { key: 'Escape', code: 'Escape' });
    expect(tip()).toBeNull();
    fireEvent.pointerOver(line.querySelector('svg') ?? line, { pointerType: 'mouse' });
    wait(1000);
    expect(tip()).toBeNull();
    fireEvent.pointerOut(line, { pointerType: 'mouse', relatedTarget: document.body });
    fireEvent.pointerOver(line, { pointerType: 'mouse' });
    wait(500);
    expect(said()?.name).toBe('Line');
  });

  it('D4 A6 never open on touch, from a touch hover or from the focus that a tap gives', () => {
    mount();
    const rectangle = button('Rectangle');
    fireEvent.pointerOver(rectangle, { pointerType: 'touch' });
    wait(1000);
    expect(tip()).toBeNull();
    fireEvent.pointerDown(rectangle, { pointerType: 'touch' });
    focus(rectangle);
    wait(1000);
    expect(tip()).toBeNull();
  });

  it('D4 close on a press, which also keeps a hovered tip closed until the pointer leaves', () => {
    mount();
    const line = button('Line');
    fireEvent.pointerOver(line, { pointerType: 'mouse' });
    wait(500);
    expect(said()?.name).toBe('Line');
    fireEvent.pointerDown(line, { pointerType: 'mouse' });
    focus(line);
    expect(tip()).toBeNull();
    fireEvent.pointerOver(line.querySelector('svg') ?? line, { pointerType: 'mouse' });
    wait(1000);
    expect(tip()).toBeNull();
    fireEvent.pointerOut(line, { pointerType: 'mouse', relatedTarget: document.body });
    fireEvent.pointerOver(line, { pointerType: 'mouse' });
    wait(500);
    expect(said()?.name).toBe('Line');
  });

  it('D4 A6 are descriptions that repeat each control’s name and keys, never its name or the only place of either', () => {
    mount();
    const opened: string[] = [];
    for (const control of screen.getAllByRole('button')) {
      focus(control);
      const shown = said();
      if (shown === null) continue;
      const name = control.getAttribute('aria-label') ?? '';
      opened.push(name);
      expect(name.startsWith(shown.name)).toBe(true);
      expect(control).toHaveAccessibleName(name);
      const description = document.getElementById(control.getAttribute('aria-describedby') ?? '');
      for (const key of shown.keys) expect(description?.textContent).toContain(key);
      // A control without a description, such as Keyboard shortcuts, has its name and tip alone.
      expect(control.getAttribute('aria-describedby') ?? '').not.toContain(tip()?.id ?? 'no tip');
    }
    expect(opened).toEqual(TIPPED);
    expect(button('Hand')).toHaveAccessibleDescription('Shortcut H. Drag to pan the canvas.');
  });
});

describe('the hover delay', () => {
  it('D4 is read from --pw-delay-tooltip in any form the built style sheet writes, and is 500 ms without it', () => {
    const root = document.createElement('main');
    document.body.append(root);
    const delays = ['500ms', '.5s', '0.2s', '.1s', '150ms', '', 'soon'].map((value) => {
      root.style.setProperty('--pw-delay-tooltip', value);
      return hoverDelay(root);
    });
    root.remove();
    expect(delays).toEqual([500, 500, 200, 100, 150, 500, 500]);
  });
});
