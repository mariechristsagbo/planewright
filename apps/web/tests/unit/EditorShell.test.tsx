import { PROTOCOL_VERSION } from '@planewright/protocol';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUILD_STATUS, FOUNDATION_CONTENTS, NOT_YET_IMPLEMENTED } from '../../src/foundation.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The editor's shell, which replaces P0's page (ADR 0012, decision 13; AGENTS.md: the UI stays
// factual): the canvas with the islands over it, and what this build contains and does not do yet
// in About this build.

const mount = () => render(<EditorShell surface={surfaceHarness().surface} />);

/** Opens About this build through the Pre-release tag, and gives the dialog (ADR 0012, D5). */
function openAbout(): HTMLElement {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Pre-release' }));
  });
  return screen.getByRole('dialog', { name: 'About this build' });
}

/** Opens the Elements drawer through its toggle, and gives the list box (ADR 0012, decision 16). */
function openElements(): HTMLElement {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /^Elements/u }));
  });
  return screen.getByRole('listbox', { name: 'Elements' });
}

/** The shell's tab stops, in document order, leaving out what is hidden. */
const tabStops = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>('button, a[href], textarea, [tabindex]')].filter(
    (element) => element.tabIndex >= 0 && element.closest('[hidden]') === null,
  );

/** The island that holds an element, by its name. */
const islandOf = (element: Element): string | undefined =>
  element.closest<HTMLElement>('[data-island]')?.dataset['island'];

describe('EditorShell', () => {
  it('AC states what the build draws and writes, that it saves in this browser and that it has no files or collaboration', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Planewright' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    // On the page, the sentence shows only in the empty-canvas note, which is no status.
    expect(screen.getByText(BUILD_STATUS)).not.toHaveAttribute('role');
    expect(openAbout()).toHaveTextContent(BUILD_STATUS);
    expect(BUILD_STATUS).toBe(
      'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them; the drawing is saved in this browser, but there are no files or collaboration yet.',
    );
  });

  it('AC lists every capability that is not implemented yet', () => {
    mount();
    expect(screen.queryByRole('region', { name: 'Not implemented yet' })).toBeNull();
    const missing = within(openAbout()).getByRole('region', { name: 'Not implemented yet' });
    expect(NOT_YET_IMPLEMENTED).toHaveLength(5);
    for (const feature of NOT_YET_IMPLEMENTED) {
      expect(missing).toHaveTextContent(feature);
    }
    expect(missing).toHaveTextContent(
      /Text formatting: every text is left-aligned in one font and size, with no font picker, wrapping or labels in shapes/,
    );
    expect(missing).toHaveTextContent(/a drawing is kept only in this browser/);
    expect(missing).not.toHaveTextContent(
      /Drawing shapes|nothing can be drawn|Undo and Redo stay|the Text tool and text editing|a reload loses/,
    );
  });

  it('lists what the build contains', () => {
    mount();
    expect(screen.queryByRole('region', { name: 'What this build contains' })).toBeNull();
    const contents = within(openAbout()).getByRole('region', { name: 'What this build contains' });
    for (const { name } of FOUNDATION_CONTENTS) {
      expect(contents).toHaveTextContent(name);
    }
    expect(contents).toHaveTextContent(
      /creation tools and text editing.*draws texts in three bundled open-licence fonts\. Drawn elements can be selected, moved, resized, rotated, duplicated, deleted and nudged, a double-click edits a text again, and each creation or edit is one undo step\./,
    );
    expect(contents).not.toHaveTextContent(/Nothing creates elements/);
    expect(contents).toHaveTextContent(
      /a list of the drawn elements that selects, nudges and deletes them from the keyboard, Enter to draw at the centre of the canvas, Undo, Redo and zoom controls, and a live region that announces each change to screen readers\./,
    );
    expect(contents).toHaveTextContent(
      /Saving in this browser.*saved in this browser’s IndexedDB storage within a second of each change and come back after a reload/,
    );
  });

  it('AC REQ-Y01 shows the tool bar, the canvas, the elements, Undo and Redo, zoom and the view as named parts', () => {
    mount();
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Drawing canvas' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Elements' })).toBeNull();
    expect(openElements()).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Zoom' })).toBeInTheDocument();
    expect(screen.getByText('View: x 0, y 0, zoom 100%')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAccessibleName();
    }
  });

  it('AC REQ-Y02 puts the tab stops in the specified order: Pre-release, tool bar, canvas, Elements and the element list while it is open, history controls, zoom controls', () => {
    mount();
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    const elements = screen.getByRole('button', { name: /^Elements/u });
    const before = [
      screen.getByRole('button', { name: 'Pre-release' }),
      toolbar.querySelector('[tabindex="0"]'),
      screen.getByRole('region', { name: 'Drawing canvas' }),
      elements,
    ];
    const after = [
      screen.getByRole('button', { name: 'Undo' }),
      screen.getByRole('button', { name: 'Redo' }),
      ...within(screen.getByRole('group', { name: 'Zoom' })).getAllByRole('button'),
    ];
    expect(tabStops()).toEqual([...before, ...after]);
    const list = openElements();
    expect(tabStops()).toEqual([...before, list, ...after]);
    expect([...before, list].map((stop) => stop?.getAttribute('tabindex') ?? null)).toEqual([
      null,
      '0',
      '0',
      null,
      '0',
    ]);
  });

  it('A7 renders the main landmark with a visually hidden h1, the islands with their controls, and the drawer closed', () => {
    mount();
    // The shell's root is the page's one main landmark, as P0's main was (the S2 review's m4).
    const main = screen.getByRole('main');
    expect(main).toHaveClass('editor-shell');
    const heading = within(main).getByRole('heading', { level: 1, name: 'Planewright' });
    expect(heading).toHaveClass('visually-hidden');
    expect(heading).not.toHaveAttribute('hidden');
    const view = screen.getByText('View: x 0, y 0, zoom 100%');
    expect(
      [
        screen.getByRole('button', { name: 'Pre-release' }),
        screen.getByRole('toolbar', { name: 'Tools' }),
        screen.getByRole('button', { name: 'Elements' }),
        screen.getByRole('group', { name: 'History' }),
        screen.getByRole('group', { name: 'Zoom' }),
        view,
      ].map(islandOf),
    ).toEqual(['identity', 'tools', 'top-right', 'bottom-left', 'bottom-left', 'bottom-right']);
    expect(islandOf(view.parentElement?.querySelector('#save-status') ?? view)).toBe(
      'bottom-right',
    );
    expect(screen.getByRole('button', { name: 'Elements' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(
      [...document.querySelectorAll('[data-island]')].every((island) => main.contains(island)),
    ).toBe(true);
  });

  it('D3 shows the mark beside the wordmark in the identity island, hidden from assistive technology', () => {
    mount();
    const identity = document.querySelector('[data-island="identity"]');
    const mark = identity?.querySelector('svg[data-glyph]');
    expect(mark).toHaveAttribute('data-glyph', 'mark');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark?.closest('.identity-mark')?.nextElementSibling).toHaveClass('wordmark');
    expect(screen.getByRole('heading', { level: 1, name: 'Planewright' })).toBeInTheDocument();
    expect(within(identity as HTMLElement).getAllByRole('button')).toEqual([
      screen.getByRole('button', { name: 'Pre-release' }),
    ]);
  });

  it('REQ-C11 keeps every island a sibling of the canvas host, never inside it', () => {
    mount();
    const host = screen.getByRole('region', { name: 'Drawing canvas' });
    const islands = [...document.querySelectorAll('[data-island]')];
    expect(islands).toHaveLength(5);
    expect(islands.filter((island) => host.contains(island) || island.contains(host))).toEqual([]);
  });

  it('D5 REQ-Y01 opens and closes the drawer with the Elements toggle, which exposes its state, closed at first', () => {
    mount();
    const toggle = screen.getByRole('button', { name: 'Elements' });
    const drawer = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).not.toBeVisible();
    expect(screen.queryByRole('listbox', { name: 'Elements' })).toBeNull();
    const list = openElements();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(drawer).toBeVisible();
    expect(drawer).toContainElement(list);
    act(() => {
      fireEvent.click(toggle);
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox', { name: 'Elements' })).toBeNull();
  });

  it('shows the shared protocol version and the independence notice', () => {
    mount();
    expect(screen.queryByText(/not affiliated with Excalidraw/)).toBeNull();
    const about = within(openAbout());
    expect(
      about.getByText(new RegExp(`Protocol version ${String(PROTOCOL_VERSION)}`)),
    ).toBeVisible();
    expect(about.getByText(/MIT licensed/)).toBeVisible();
    expect(about.getByText(/not affiliated with Excalidraw/)).toBeVisible();
    expect(about.getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/mariechristsagbo/planewright',
    );
  });

  it('D5 opens About this build from the Pre-release tag as a modal dialog, which Close closes', () => {
    mount();
    const tag = screen.getByRole('button', { name: 'Pre-release' });
    expect(tag).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).toBeNull();
    const about = openAbout();
    expect(within(about).getByRole('button', { name: 'Close' })).toHaveFocus();
    act(() => {
      fireEvent.click(within(about).getByRole('button', { name: 'Close' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tag).toHaveFocus();
  });
});
