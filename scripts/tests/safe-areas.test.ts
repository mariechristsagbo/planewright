import { describe, expect, it } from 'vitest';

import { declarationsOf, rulesOf, styleSheet } from './style-sheets.ts';

// The safe areas (ADR 0012, decision 14; the v0.2 plan's responsive rule 1 and S8, issue #73's D8):
// shell.css reads the four env(safe-area-inset-*) values once, into custom properties outside the
// tokens, and every anchor adds its side's: each padding of the shell, in shell.css and in
// responsive.css, and the phone's sheets' margins, which take them to the window's edges, and their
// inner bottom padding, which keeps their last control above the bottom inset.

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** The declarations of a property in the rules of a selector, in a style sheet's order. */
const valuesOf = (sheet: string, selector: string, property: string): string[] =>
  rulesOf(styleSheet(sheet))
    .filter((rule) => rule.selector === selector)
    .flatMap(({ body }) => declarationsOf(body))
    .filter((declaration) => declaration.property === property)
    .map(({ value }) => value);

/** Whether a value reads the inset properties of these sides, in this order. */
const reads = (value: string, sides: readonly string[]): boolean =>
  new RegExp(sides.map((side) => `var\\(--shell-safe-${side}\\)`).join('[\\s\\S]*'), 'u').test(
    value,
  );

describe('the safe areas', () => {
  it('are read once, on :root in shell.css, from env(safe-area-inset-*) with 0px when absent', () => {
    const roots = rulesOf(styleSheet('shell.css')).filter(({ selector }) => selector === ':root');
    expect(roots).toHaveLength(1);
    expect(declarationsOf(roots[0]?.body ?? '')).toEqual(
      SIDES.map((side) => ({
        property: `--shell-safe-${side}`,
        value: `env(safe-area-inset-${side}, 0px)`,
      })),
    );
    expect(styleSheet('tokens.css')).not.toMatch(/--shell-safe/u);
  });

  it('are added to every padding of the shell, 16, 12 and 8 px, in shell.css and responsive.css', () => {
    const paddings = [
      ...valuesOf('shell.css', '.editor-shell', 'padding'),
      ...valuesOf('responsive.css', '.editor-shell', 'padding'),
    ];
    expect(paddings).toHaveLength(4);
    expect(paddings.filter((value) => !reads(value, SIDES))).toEqual([]);
    expect(
      paddings.map((value) => /--pw-spacing-(?<size>lg|md|sm)/u.exec(value)?.groups?.['size']),
    ).toEqual(['lg', 'md', 'sm', 'sm']);
  });

  it('take the phone’s sheets to the window’s edges and their content above the bottom inset', () => {
    for (const selector of ['.element-list-drawer', '.details-sheet']) {
      const margins = valuesOf('responsive.css', selector, 'margin');
      expect(margins, selector).toHaveLength(1);
      expect(reads(margins[0] ?? '', ['right', 'bottom', 'left']), selector).toBe(true);
    }
    for (const selector of ['.element-list-drawer > .element-list-area', '.details-sheet']) {
      const padding = valuesOf('responsive.css', selector, 'padding-bottom');
      expect(
        padding.filter((value) => reads(value, ['bottom'])),
        selector,
      ).toHaveLength(1);
    }
  });

  it('bound the menu and More’s popover inside the window less its anchors and insets', () => {
    expect(reads(valuesOf('menu.css', '.chrome-menu', 'width')[0] ?? '', ['left', 'right'])).toBe(
      true,
    );
    expect(
      reads(valuesOf('menu.css', '.chrome-menu', 'max-height')[0] ?? '', ['top', 'bottom']),
    ).toBe(true);
    expect(
      reads(valuesOf('dock.css', '.more-tools', 'max-width')[0] ?? '', ['left', 'right']),
    ).toBe(true);
  });
});
