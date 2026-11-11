import type { Editor } from '@planewright/engine';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The Elements toggle (ADR 0012, decisions 8 and 14; the v0.2 plan's S5, issue #66's D1): its
// glyph, its word and the count of the drawn elements, which is hidden from assistive technology so
// that the toggle's name stays exactly "Elements" and a change that the live region announces is
// not said a second time.

function mount() {
  const harness = surfaceHarness();
  harness.editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  render(<EditorShell surface={harness.surface} />);
  const toggle = screen.getByRole('button', { name: 'Elements' });
  const count = (): string | null | undefined => toggle.querySelector('.toggle-count')?.textContent;
  return { ...harness, toggle, count };
}

/** Draws one element with a tool at the centre of the canvas, as Enter does. */
function draw(editor: Editor, tool: 'rectangle' | 'ellipse'): void {
  act(() => {
    editor.run(`tool.${tool}`);
    editor.run('canvas.enter');
  });
}

describe('the Elements toggle', () => {
  it('D1 A2 shows the count of the drawn elements, which follows them', () => {
    const { editor, count } = mount();
    expect(count()).toBe('0');
    draw(editor, 'rectangle');
    expect(count()).toBe('1');
    draw(editor, 'ellipse');
    expect(count()).toBe('2');
    act(() => {
      editor.run('selection.delete');
    });
    expect(count()).toBe('1');
    act(() => {
      editor.run('history.undo');
    });
    expect(count()).toBe('2');
  });

  it('D1 A2 keeps its name exactly "Elements": the count and the glyph are hidden from assistive technology', () => {
    const { editor, toggle, count } = mount();
    draw(editor, 'rectangle');
    draw(editor, 'ellipse');
    expect(count()).toBe('2');
    expect(toggle).toHaveAccessibleName('Elements');
    expect(toggle.querySelector('.toggle-count')).toHaveAttribute('aria-hidden', 'true');
    expect(toggle.querySelector('svg[data-glyph="elements"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(toggle).toHaveTextContent(/^Elements2$/u);
    expect(toggle).not.toHaveAttribute('aria-label');
    expect(toggle).not.toHaveAttribute('aria-describedby');
  });

  it('D1 says nothing of the count, which no live region holds, so a change is announced once, by the live region', () => {
    const { editor, toggle } = mount();
    draw(editor, 'rectangle');
    const live = '[aria-live], [role="status"], [role="alert"], [role="log"]';
    expect(toggle.closest(live)).toBeNull();
    expect(toggle.querySelector(live)).toBeNull();
    expect(toggle).not.toHaveAttribute('aria-atomic');
  });

  it('D2 A3 exposes its state with aria-expanded and controls the drawer, whose element is there while it is closed', () => {
    const { toggle } = mount();
    const drawer = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toBeInTheDocument();
    expect(drawer).not.toBeVisible();
    act(() => {
      toggle.click();
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toBe(drawer);
    expect(drawer).toBeVisible();
  });
});
