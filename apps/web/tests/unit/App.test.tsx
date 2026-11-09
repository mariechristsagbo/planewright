import { PROTOCOL_VERSION } from '@planewright/protocol';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../../src/App.tsx';
import { BUILD_STATUS, FOUNDATION_CONTENTS, NOT_YET_IMPLEMENTED } from '../../src/foundation.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The page (AGENTS.md: the UI stays factual): the editor surface, and what this build contains
// and does not do yet.

const mount = () => render(<App surface={surfaceHarness().surface} />);

describe('App', () => {
  it('AC states what the build draws and writes, that it saves in this browser and that it has no files or collaboration', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Planewright' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(BUILD_STATUS);
    expect(BUILD_STATUS).toBe(
      'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them; the drawing is saved in this browser, but there are no files or collaboration yet.',
    );
  });

  it('AC lists every capability that is not implemented yet', () => {
    mount();
    const missing = screen.getByRole('region', { name: 'Not implemented yet' });
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
    const contents = screen.getByRole('region', { name: 'What this build contains' });
    for (const { name } of FOUNDATION_CONTENTS) {
      expect(contents).toHaveTextContent(name);
    }
    expect(contents).toHaveTextContent(
      /creation tools and text editing.*draws texts in three bundled open-licence fonts\. Drawn elements can be selected, moved, resized, rotated, duplicated, deleted and nudged, a double-click edits a text again, and each creation or edit is one undo step\./,
    );
    expect(contents).not.toHaveTextContent(/Nothing creates elements/);
    expect(contents).toHaveTextContent(
      /Saving in this browser.*saved in this browser’s IndexedDB storage within a second of each change and come back after a reload/,
    );
  });

  it('AC REQ-Y01 shows the tool bar, the canvas, Undo and Redo and the view as named parts', () => {
    mount();
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Drawing canvas' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('View: x 0, y 0, zoom 100%')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAccessibleName();
    }
  });

  it('shows the shared protocol version and the independence notice', () => {
    mount();
    expect(
      screen.getByText(new RegExp(`Protocol version ${String(PROTOCOL_VERSION)}`)),
    ).toBeVisible();
    expect(screen.getByText(/not affiliated with Excalidraw/)).toBeVisible();
  });
});
