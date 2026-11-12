import { expect, test } from '@playwright/test';

import { openElements, openPage, polite } from './a11y.ts';
import { toolButton } from './drawing.ts';
import { canvas } from './support.ts';

// The controls' state colours (ADR 0012, decision 3; the v0.2 plan's S10, issue #77's D9): the
// accent is kept for state, so a pressed control takes the violet container with its content in
// the container's content colour and its edge in the accent, an unavailable one the disabled
// content colour with P0's dashed border, every focus ring 2 px of the focus ring's violet at a
// 2 px offset with a white halo filling it, a selected row the container's colours, and the text
// area a 2 px violet outline. Page code is written as strings, since these files compile without
// the DOM library.

const VIOLET = 'rgb(101, 71, 180)';
const CONTAINER = 'rgb(238, 234, 255)';
const ON_CONTAINER = 'rgb(81, 57, 145)';
const DISABLED = 'rgb(104, 104, 115)';

/** The computed state styles of the first element that a selector finds. */
const STATE = (selector: string) => `(() => {
  const style = getComputedStyle(document.querySelector('${selector}'));
  return {
    colour: style.color,
    background: style.backgroundColor,
    border: style.borderTopColor + ' ' + style.borderTopStyle,
    outline: [style.outlineStyle, style.outlineWidth, style.outlineColor, style.outlineOffset].join(' '),
    halo: style.boxShadow,
  };
})()`;

interface State {
  readonly colour: string;
  readonly background: string;
  readonly border: string;
  readonly outline: string;
  readonly halo: string;
}

const TOOL = (name: string) => `[role="toolbar"] button[aria-label="${name}"]`;

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 800, height: 720 },
]) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('D9 A11 the pressed Rectangle and tool lock take the violet container, its content colour, and a violet edge', async ({
      page,
    }) => {
      await openPage(page);
      await canvas(page).focus();
      await page.keyboard.press('r');
      await page.keyboard.press('q');
      for (const name of ['Rectangle', 'Tool lock']) {
        await expect(toolButton(page, name)).toHaveAttribute('aria-pressed', 'true');
        const pressed = await page.evaluate<State>(STATE(TOOL(name)));
        expect([pressed.colour, pressed.background, pressed.border], name).toEqual([
          ON_CONTAINER,
          CONTAINER,
          `${VIOLET} solid`,
        ]);
      }
      const key = await page.evaluate<State>(STATE(`${TOOL('Rectangle')} .tool-key`));
      expect(key.colour).toBe(ON_CONTAINER);
    });

    test('D9 A11 the unavailable Redo takes the disabled content colour and keeps its dashed border', async ({
      page,
    }) => {
      await openPage(page);
      await expect(page.getByRole('button', { name: 'Redo' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      const redo = await page.evaluate<State>(STATE('button[aria-label="Redo"]'));
      expect([redo.colour, redo.border]).toEqual([DISABLED, `${DISABLED} dashed`]);
    });

    test('D9 A11 Undo, focused by Tab, shows a 2 px violet ring at a 2 px offset with a white halo filling it', async ({
      page,
    }) => {
      await openPage(page);
      for (let stop = 0; stop < 6; stop += 1) await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Undo' })).toBeFocused();
      const undo = await page.evaluate<State>(STATE('button[aria-label="Undo"]'));
      expect([undo.outline, undo.halo]).toEqual([
        `solid 2px ${VIOLET} 2px`,
        'rgb(255, 255, 255) 0px 0px 0px 2px',
      ]);
    });

    test('D9 A11 a selected row takes the container’s colours, its figures too, and the text area a 2 px violet outline', async ({
      page,
    }) => {
      await openPage(page);
      await canvas(page).focus();
      await page.keyboard.press('r');
      await page.keyboard.press('Enter');
      await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
      await openElements(page);
      const row = await page.evaluate<State>(STATE('[role="option"][aria-selected="true"]'));
      const figures = await page.evaluate<State>(
        STATE('[role="option"][aria-selected="true"] .element-row-meta'),
      );
      expect([row.colour, row.background, figures.colour]).toEqual([
        ON_CONTAINER,
        CONTAINER,
        ON_CONTAINER,
      ]);
      await canvas(page).focus();
      await page.keyboard.press('t');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Text' })).toBeFocused();
      const area = await page.evaluate<State>(STATE('#text-editor'));
      expect(area.outline).toBe(`solid 2px ${VIOLET} 0px`);
    });
  });
}
