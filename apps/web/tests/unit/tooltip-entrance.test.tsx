import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// A tooltip inside an entering surface (ADR 0012, D2; the v0.2 plan's S12): a control's box moves
// with its surface's translation until the surface's entrance ends, so a tip that opened during the
// entrance, as the keyboard's focus opens one at once, is placed again at the entrance's end, where
// its control has come to rest, 8 px from it as S3 places it. Tooltip.test.tsx holds the rest.

const mount = () => render(<EditorShell surface={surfaceHarness().surface} />);
const tip = (): HTMLElement | null => screen.queryByRole('tooltip');
const button = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('a tip inside an entering surface', () => {
  /** Gives the control a box whose top is at this height, as a translated surface would. */
  const at = (control: HTMLElement, top: number): void => {
    const box = {
      x: 100,
      y: top,
      left: 100,
      top,
      width: 36,
      height: 36,
      right: 136,
      bottom: top + 36,
    };
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue({ ...box, toJSON: () => box });
  };
  const tipTop = (): number => parseFloat(tip()?.style.top ?? 'NaN');

  it('D8 is placed again at its control’s settled place when the surface around the control ends its entrance, and for no other', () => {
    mount();
    const rectangle = button('Rectangle');
    at(rectangle, 64);
    act(() => {
      rectangle.focus();
    });
    expect(tip()?.querySelector('.chrome-tip-name')?.textContent).toBe('Rectangle');
    expect(tipTop()).toBe(108);
    at(rectangle, 60);
    const elsewhere = button('Undo').closest('[data-island]');
    if (elsewhere === null) throw new Error('Undo is in no island.');
    fireEvent.animationEnd(elsewhere);
    expect(tipTop()).toBe(108);
    const surface = rectangle.closest('[data-island]');
    if (surface === null) throw new Error('Rectangle is in no island.');
    fireEvent.animationEnd(surface);
    expect(tipTop()).toBe(104);
    expect(tip()?.style.getPropertyValue('--chrome-tip-reach')).toBe('8px');
    expect(tip()?.dataset['side']).toBe('below');
  });
});
