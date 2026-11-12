import type { Editor } from '@planewright/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { startText, tabStops } from '../support/session.ts';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// The active tool's hint line (ADR 0012, decisions 1 and 3; the v0.2 plan's S10, issue #77's D5):
// one caption line right after the tools island saying what the active tool does, following every
// way the tool changes, absent while a text is edited, and plain text that nothing announces,
// describes by or tabs to. jsdom answers no media query, so the hint renders as on a desktop; on a
// phone it is the style sheet that hides it. This test holds its own copy of D4's words.

const HINTS = {
  hand: 'Drag to pan the view',
  selection: 'Select, move, resize or rotate what is drawn',
  rectangle: 'Drag to draw a rectangle; tap for the default size',
  ellipse: 'Drag to draw an ellipse; tap for the default size',
};

/** The shell on a desktop, with its editor. */
function mount(): Editor {
  const { editor, surface } = surfaceHarness();
  render(<EditorShell surface={surface} />);
  return editor;
}

const hint = (): HTMLElement | null => document.getElementById('tool-hint');

/** The hint's words, or null while there is no hint. */
const words = (): string | null => hint()?.textContent ?? null;

/** Runs commands one after another, each in its own act, as presses would. */
function run(editor: Editor, ...commands: Parameters<Editor['run']>[0][]): void {
  for (const command of commands) {
    act(() => {
      editor.run(command);
    });
  }
}

describe('the tool hint', () => {
  it('D5 A6 shows Selection’s words at load, in a paragraph right after the tools island', () => {
    mount();
    expect(words()).toBe(HINTS.selection);
    expect(hint()?.tagName).toBe('P');
    expect(hint()).toHaveClass('tool-hint');
    expect(document.querySelector('[data-island="tools"]')?.nextElementSibling).toBe(hint());
  });

  it('D5 A6 follows a tool’s command, the return to Selection after a creation, and tool lock keeping a creation tool', () => {
    const editor = mount();
    run(editor, 'tool.rectangle');
    expect(words()).toBe(HINTS.rectangle);
    run(editor, 'canvas.enter');
    expect(editor.view.elements).toHaveLength(1);
    expect(words()).toBe(HINTS.selection);
    run(editor, 'tool.lock', 'tool.rectangle', 'canvas.enter');
    expect(editor.view.elements).toHaveLength(2);
    expect(words()).toBe(HINTS.rectangle);
  });

  it('D5 A6 follows a press on the palette', () => {
    mount();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Ellipse' }));
    });
    expect(words()).toBe(HINTS.ellipse);
  });

  it('D5 A6 follows More’s items on a phone in portrait, where the style sheet hides it', () => {
    phoneQuery(true);
    mount();
    const more = screen.getByRole('button', { name: 'More' });
    act(() => {
      fireEvent.pointerDown(more, { pointerType: 'touch' });
      fireEvent.click(more);
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
    });
    expect(words()).toBe(HINTS.hand);
  });

  it('D5 A9 is absent while a text is edited, and shows Selection’s words once the text is committed', () => {
    const editor = mount();
    startText(editor);
    expect(editor.view.text).not.toBeNull();
    expect(hint()).toBeNull();
    act(() => {
      editor.editText({ type: 'value', text: 'Plan' });
      editor.editText({ type: 'commit' });
    });
    expect(words()).toBe(HINTS.selection);
  });

  it('D5 A10 is plain text: no role, live region, tab stop or island, and no element is described by it', () => {
    mount();
    const element = hint();
    expect(element).not.toBeNull();
    for (const attribute of ['role', 'aria-live', 'tabindex', 'data-island', 'aria-hidden']) {
      expect(element?.getAttribute(attribute)).toBeNull();
    }
    expect(tabStops()).not.toContain(element);
    const described = [...document.querySelectorAll('[aria-describedby]')].flatMap(
      (each) => each.getAttribute('aria-describedby')?.split(/\s+/u) ?? [],
    );
    expect(described.length).toBeGreaterThan(0);
    expect(described).not.toContain('tool-hint');
  });
});
