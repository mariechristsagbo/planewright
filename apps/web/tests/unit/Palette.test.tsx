import type { EditorCommand } from '@planewright/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ariaKeyShortcuts } from '../../src/ui/shortcuts.ts';
import { Toolbar } from '../../src/ui/Toolbar.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The palette (ADR 0012, decision 3, and the v0.2 plan's S3): P0's tool bar, whose buttons show
// the tools' original glyphs in groups split by hairlines, each with its key in a corner that
// assistive technology does not read, and tool lock's padlock, closed while tool lock is on. The
// names, keys and descriptions stay the tool bar's (Toolbar.test.tsx).

function mount() {
  const harness = surfaceHarness();
  render(harness.wrap(<Toolbar />));
  const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
  return { ...harness, toolbar, buttons: within(toolbar).getAllByRole('button') };
}

/** The name of the glyph that a button shows, if it shows one. */
const glyphOf = (button: HTMLElement): string | null | undefined =>
  button.querySelector('svg[data-glyph]')?.getAttribute('data-glyph');

/** The registry's tools in its order, then tool lock: the palette's buttons. */
function registryButtons(commands: readonly EditorCommand[]): EditorCommand[] {
  const tools = commands.filter(({ tool }) => tool !== undefined);
  const lock = commands.filter(({ id }) => id === 'tool.lock');
  return [...tools, ...lock];
}

describe('the palette', () => {
  it('D2 D6 A2 has one button per registry tool, in registry order, each with its glyph and aria-keyshortcuts', () => {
    const { editor, buttons } = mount();
    const expected = registryButtons(editor.commands);
    expect(expected.map(({ id }) => id)).toEqual([
      'tool.hand',
      'tool.selection',
      'tool.rectangle',
      'tool.ellipse',
      'tool.diamond',
      'tool.line',
      'tool.freehand',
      'tool.text',
      'tool.lock',
    ]);
    expect(buttons).toHaveLength(expected.length);
    expected.forEach((command, index) => {
      const button = buttons[index];
      expect(button).toHaveAccessibleName(command.label);
      expect(button).toHaveAttribute(
        'aria-keyshortcuts',
        ariaKeyShortcuts(command.shortcuts, 'other'),
      );
    });
    expect(buttons.map(glyphOf)).toEqual([
      'hand',
      'selection',
      'rectangle',
      'ellipse',
      'diamond',
      'line',
      'freehand',
      'text',
      'lock-open',
    ]);
  });

  it('D2 A3 shows each button’s first key in a corner hidden from assistive technology, which still hears every key', () => {
    const { buttons, toolbar } = mount();
    for (const button of buttons) {
      const keys = button.querySelectorAll('kbd');
      expect(keys).toHaveLength(1);
      expect(keys[0]).toHaveAttribute('aria-hidden', 'true');
      expect(keys[0]).toHaveClass('tool-key');
    }
    expect(buttons.map((button) => button.querySelector('kbd')?.textContent)).toEqual([
      'H',
      'V',
      'R',
      'O',
      'D',
      'L',
      'P',
      'T',
      'Q',
    ]);
    const selection = within(toolbar).getByRole('button', { name: 'Selection' });
    expect(selection).toHaveAttribute('aria-keyshortcuts', 'V 1');
    expect(selection).toHaveAccessibleDescription(/^Shortcuts V or 1\. /u);
  });

  it('D2 splits its groups with hairlines hidden from assistive technology: Hand and Selection, the drawing tools, then tool lock', () => {
    const { toolbar } = mount();
    const dividers = [...toolbar.querySelectorAll('.tool-divider')];
    expect(dividers).toHaveLength(2);
    for (const divider of dividers) {
      expect(divider).toHaveAttribute('aria-hidden', 'true');
      expect(divider).toBeEmptyDOMElement();
    }
    const next = dividers.map((divider) => divider.nextElementSibling);
    expect(next[0]).toHaveAccessibleName('Rectangle');
    expect(next[1]).toHaveAccessibleName('Tool lock');
  });

  it('D2 D6 A4 shows the padlock closed with aria-pressed while tool lock is on, and open otherwise, from a press, its key or the editor', () => {
    const { editor, toolbar } = mount();
    const lock = within(toolbar).getByRole('button', { name: 'Tool lock' });
    const state = () => [editor.view.toolLock, lock.getAttribute('aria-pressed'), glyphOf(lock)];
    expect(state()).toEqual([false, 'false', 'lock-open']);
    fireEvent.click(lock);
    expect(state()).toEqual([true, 'true', 'lock-closed']);
    fireEvent.keyDown(lock, { key: 'q', code: 'KeyQ' });
    expect(state()).toEqual([false, 'false', 'lock-open']);
    act(() => {
      editor.run('tool.lock');
    });
    expect(state()).toEqual([true, 'true', 'lock-closed']);
    expect(lock).toHaveAccessibleName('Tool lock');
  });
});
