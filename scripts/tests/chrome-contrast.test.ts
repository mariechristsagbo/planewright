import { describe, expect, it } from 'vitest';

import { tokenValues } from './style-sheets.ts';

// The v0.2 plan's contrast pairs (docs/architecture/editor-experience.md#contrast-pairs, ADR 0012
// decision 3): each foreground token on its background measures the plan's ratio, computed here
// from tokens.css, and text meets 4.5:1 and the last six, which are not text, 3:1.

const PAIRS = [
  { foreground: 'on-surface', background: 'surface', ratio: '16.70', minimum: 4.5 },
  { foreground: 'on-surface-variant', background: 'surface', ratio: '8.16', minimum: 4.5 },
  { foreground: 'on-surface-muted', background: 'surface', ratio: '5.50', minimum: 4.5 },
  { foreground: 'on-surface-muted', background: 'surface-hover', ratio: '4.71', minimum: 4.5 },
  { foreground: 'on-surface-muted', background: 'surface-muted', ratio: '5.10', minimum: 4.5 },
  { foreground: 'on-surface', background: 'surface-muted', ratio: '15.48', minimum: 4.5 },
  { foreground: 'on-surface-variant', background: 'surface-muted', ratio: '7.57', minimum: 4.5 },
  { foreground: 'disabled-content', background: 'surface', ratio: '5.50', minimum: 4.5 },
  {
    foreground: 'on-primary-container',
    background: 'primary-container',
    ratio: '7.61',
    minimum: 4.5,
  },
  { foreground: 'on-primary-container', background: 'primary-line', ratio: '6.44', minimum: 4.5 },
  { foreground: 'on-primary-container', background: 'primary-tint', ratio: '8.30', minimum: 4.5 },
  { foreground: 'on-primary', background: 'primary', ratio: '6.74', minimum: 4.5 },
  { foreground: 'on-primary', background: 'primary-strong', ratio: '8.96', minimum: 4.5 },
  { foreground: 'error', background: 'surface', ratio: '6.52', minimum: 4.5 },
  { foreground: 'on-error-container', background: 'error-container', ratio: '7.99', minimum: 4.5 },
  {
    foreground: 'on-warning-container',
    background: 'warning-container',
    ratio: '6.53',
    minimum: 4.5,
  },
  { foreground: 'on-inverse-surface', background: 'inverse-surface', ratio: '16.70', minimum: 4.5 },
  { foreground: 'focus-ring', background: 'surface', ratio: '6.74', minimum: 3 },
  { foreground: 'focus-ring', background: 'canvas', ratio: '6.74', minimum: 3 },
  { foreground: 'selection', background: 'canvas', ratio: '6.74', minimum: 3 },
  { foreground: 'primary', background: 'primary-container', ratio: '5.73', minimum: 3 },
  { foreground: 'outline-strong', background: 'surface', ratio: '3.96', minimum: 3 },
  { foreground: 'ink', background: 'canvas', ratio: '15.55', minimum: 3 },
];

/** The relative luminance of an opaque six-digit sRGB colour (WCAG 2). */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two colour tokens of tokens.css, which must be opaque. */
function contrastOf(foreground: string, background: string): number {
  const colours = [foreground, background].map((name) => {
    const value = tokenValues().get(`--pw-color-${name}`) ?? '';
    if (!/^#[\da-f]{6}$/u.test(value)) throw new Error(`--pw-color-${name} is "${value}".`);
    return luminance(value);
  });
  const [light = 0, dark = 0] = colours.sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe('the contrast pairs of the chrome tokens', () => {
  it('are the plan’s 23', () => {
    expect(PAIRS).toHaveLength(23);
  });

  it.each(PAIRS)(
    '$foreground on $background measures $ratio:1, at least $minimum:1',
    ({ foreground, background, ratio, minimum }) => {
      const measured = contrastOf(foreground, background);
      expect(measured.toFixed(2)).toBe(ratio);
      expect(measured).toBeGreaterThanOrEqual(minimum);
    },
  );
});
