import { act, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { figuresOf } from '../../src/shell/selection/geometry.ts';
import { SelectionPanel } from '../../src/shell/selection/SelectionPanel.tsx';
import { surfaceHarness } from '../support/surface.tsx';
import { phoneQuery } from '../support/viewport.ts';

// The phone's selection bar (ADR 0012, decisions 2 and 14; the v0.2 plan's S6, issue #69's D3, A6
// and A8): under the phone sheet's query it takes the panel's place, with the same heading and the
// same actions under the same rules, their words visually hidden, then Details, which controls the
// Details sheet; neither renders at a camera step.

// The geometry is spied on, not replaced, to count how often the figures are written.
vi.mock(import('../../src/shell/selection/geometry.ts'), { spy: true });

/** Draws a text from the keyboard, which stays selected with the Selection tool. */
function textHarness() {
  const harness = surfaceHarness();
  harness.editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  act(() => {
    harness.editor.run('tool.text');
    harness.editor.run('canvas.enter');
    harness.editor.editText({ type: 'value', text: 'Plan' });
    harness.editor.editText({ type: 'commit' });
  });
  return harness;
}

describe('the selection bar', () => {
  it('D3 A6 shows in the panel’s place on a phone, with the same heading and actions, then Details', () => {
    phoneQuery(true);
    const { editor, surface } = textHarness();
    render(<EditorShell surface={surface} />);
    expect(document.querySelector('.selection-panel')).toBeNull();
    const bar = screen.getByRole('group', { name: 'Text' });
    expect(bar).toHaveAttribute('data-island', 'selection');
    const buttons = within(bar).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Duplicate',
      'Delete',
      'Edit text',
      'Details',
    ]);
    for (const button of buttons) {
      expect(button.querySelector('span')).toHaveClass('visually-hidden');
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    expect(buttons[0]).toHaveAttribute('aria-keyshortcuts', 'Control+D');
    expect(buttons[3]).toHaveAttribute('aria-expanded', 'false');
    expect(buttons[3]).toHaveAttribute('aria-controls', 'details-sheet');
    // Edit text follows canvas.enter's rule here too.
    act(() => {
      editor.run('tool.hand');
    });
    expect(within(bar).queryByRole('button', { name: 'Edit text' })).toBeNull();
    expect(bar.closest('[inert]')).toBeNull();
  });

  it('A8 renders the bar and the open Details sheet not at all across ten camera steps', () => {
    const { editor, wrap } = textHarness();
    const controls = {
      details: true,
      drawer: false,
      onToggleDetails: vi.fn(),
      onCloseDetails: vi.fn(),
    };
    const commits = vi.fn();
    render(
      wrap(
        <Profiler id="selection" onRender={commits}>
          <SelectionPanel sheet controls={controls} />
        </Profiler>,
      ),
    );
    expect(screen.getByRole('region', { name: 'Details' })).toBeVisible();
    const written = vi.mocked(figuresOf);
    commits.mockClear();
    written.mockClear();
    const { camera } = editor.view;
    for (let step = 0; step < 10; step += 1) {
      act(() => {
        editor.run(step % 2 === 0 ? 'view.zoom-in' : 'view.zoom-out');
      });
    }
    expect(editor.view.camera).not.toBe(camera);
    expect([commits.mock.calls.length, written.mock.calls.length]).toEqual([0, 0]);
    act(() => {
      editor.run('selection.duplicate');
    });
    expect(commits).toHaveBeenCalled();
    expect(written).toHaveBeenCalled();
  });
});
