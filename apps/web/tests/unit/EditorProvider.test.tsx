import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useEditorView, useSurface } from '../../src/editor/surface.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The editor provider: one editor surface for the components below it, whose view they read
// through useSyncExternalStore (docs/architecture/engine/modules.md#public-surface).

function Tool() {
  return <p>{useEditorView().tool}</p>;
}

describe('the editor provider', () => {
  it('gives the components below it the editor’s view, and renders again when it changes', async () => {
    const { editor, wrap } = surfaceHarness();
    render(wrap(<Tool />));
    expect(screen.getByText('selection')).toBeInTheDocument();
    editor.run('tool.hand');
    expect(await screen.findByText('hand')).toBeInTheDocument();
  });

  it('gives the surface itself to its components', () => {
    const { surface, wrap } = surfaceHarness();
    const { result } = renderHook(() => useSurface(), {
      wrapper: ({ children }) => wrap(children),
    });
    expect(result.current).toBe(surface);
  });

  it('is required: a component outside it is refused', () => {
    expect(() => renderHook(() => useSurface())).toThrow(
      'The editor surface needs an EditorProvider above it.',
    );
  });
});
