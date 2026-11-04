import { PROTOCOL_VERSION } from '@planewright/protocol';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../../src/App.tsx';
import { NOT_YET_IMPLEMENTED } from '../../src/foundation.ts';

describe('App', () => {
  it('labels the build as a foundation rather than a working editor', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Planewright' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Foundation only — this build is not a drawing editor.',
    );
  });

  it('lists every capability that is not implemented yet', () => {
    render(<App />);
    const missing = screen.getByRole('region', { name: 'Not implemented yet' });
    for (const feature of NOT_YET_IMPLEMENTED) {
      expect(missing).toHaveTextContent(feature);
    }
  });

  it('shows the shared protocol version and the independence notice', () => {
    render(<App />);
    expect(
      screen.getByText(new RegExp(`Protocol version ${String(PROTOCOL_VERSION)}`)),
    ).toBeVisible();
    expect(screen.getByText(/not affiliated with Excalidraw/)).toBeVisible();
  });
});
