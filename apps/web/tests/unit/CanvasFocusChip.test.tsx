import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CANVAS_ID } from '../../src/a11y/focus.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { tabStops } from '../support/session.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The canvas's focus ring and chip (ADR 0012, decision 3; the v0.2 plan's S10, issue #77's D1 to
// D3): an element of their own after the canvas host, inside the canvas's stage and never inside
// the host, which the style sheet shows while the host matches :focus-visible, holding the chip's
// "Canvas focused"; hidden from assistive technology, since the region's name already says what
// has the focus, with no role and no tab stop. jsdom applies no style sheet, so the end-to-end
// tests read what shows and when.

const mount = () => render(<EditorShell surface={surfaceHarness().surface} />);

describe('the canvas’s focus ring and chip', () => {
  it('D2 A3 one element hidden from assistive technology holds "Canvas focused", with no role and no tab stop', () => {
    mount();
    expect(screen.getAllByText(/Canvas focused/u)).toHaveLength(1);
    const chip = screen.getByText('Canvas focused');
    const ring = chip.closest('[aria-hidden="true"]');
    expect(ring).toHaveClass('canvas-focus-ring');
    expect(chip).toHaveClass('canvas-focus-chip');
    for (const element of [ring, chip]) {
      expect(element?.getAttribute('role')).toBeNull();
      expect(element?.hasAttribute('tabindex')).toBe(false);
    }
    expect(tabStops().filter((stop) => ring?.contains(stop) === true)).toEqual([]);
  });

  it('D1 D2 follows the host inside the canvas’s stage, as #drawing-canvas ~ .canvas-focus-ring, never inside the host', () => {
    mount();
    const host = document.getElementById(CANVAS_ID);
    const ring = document.querySelector(`#${CANVAS_ID} ~ .canvas-focus-ring`);
    expect(ring).toHaveTextContent('Canvas focused');
    expect(ring?.parentElement).toHaveClass('canvas-stage');
    expect(ring?.parentElement).toBe(host?.parentElement);
    expect(host?.contains(ring)).toBe(false);
    // The region keeps its name and description.
    expect(screen.getByRole('region', { name: 'Drawing canvas' })).toBe(host);
    expect(host).toHaveAttribute('aria-describedby', 'canvas-instructions');
  });

  it('A3 no role query finds the chip, which only a query of hidden elements reaches', () => {
    mount();
    const chips = (hidden: boolean) =>
      screen
        .queryAllByRole('paragraph', { hidden })
        .filter((paragraph) => paragraph.textContent === 'Canvas focused');
    expect(chips(false)).toHaveLength(0);
    expect(chips(true)).toHaveLength(1);
  });
});
