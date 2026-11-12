import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { elementsToggle, openElements, openPage, polite } from './a11y.ts';
import { mouseClick, mouseDrag, toolButton } from './drawing.ts';
import { boxOf, drawText, figuresIn, onCanvas, panelButton, selectionSurface } from './panel.ts';
import { canvasBox } from './support.ts';

// The selection panel on desktops and tablets (ADR 0012, decisions 2, 8 and 14; the v0.2 plan's S6,
// issue #69's D2): none at rest; with a selection, 232 px wide at the anchor under the top row, at
// 16 / 72 on desktops, and at compact widths under the tool hint's row too (S10, issue #77's D7),
// its figures those of the element's list row, its values in JetBrains Mono,
// its targets 44 px under a coarse pointer, and presses on it reaching no canvas. Page code is
// written as strings, since these files compile without the DOM library.

const VIEWPORTS = [
  { width: 1440, height: 900, anchor: 16, touch: false },
  { width: 1280, height: 720, anchor: 16, touch: false },
  { width: 800, height: 720, anchor: 12, touch: false },
  { width: 1024, height: 768, anchor: 12, touch: true },
] as const;

for (const { width, height, anchor, touch } of VIEWPORTS) {
  test.describe(`at ${String(width)} × ${String(height)}${touch ? ' with touch' : ''}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch });

    test('D2 A3 no panel at rest; a selected rectangle shows it 232 px wide at the anchor under the top row', async ({
      page,
    }) => {
      await openPage(page);
      await expect(selectionSurface(page)).toHaveCount(0);
      await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
      await expect(selectionSurface(page)).toBeVisible();
      const panel = await boxOf(selectionSurface(page));
      const identity = await boxOf(page.locator('[data-island="identity"]'));
      // The shell's 8 px gap and a 2 px step under the top row: 16 / 72 on desktops. At compact
      // widths the tool hint's 18 px row and its gap come between them (the v0.2 plan's S10).
      expect([panel.x, panel.y, panel.width]).toEqual([
        anchor,
        identity.y + identity.height + (width >= 1200 ? 10 : 36),
        232,
      ]);
      if (width >= 1200) expect([panel.x, panel.y]).toEqual([16, 72]);
      expect(await page.evaluate<boolean>("matchMedia('(pointer: coarse)').matches")).toBe(touch);
      for (const name of ['Duplicate', 'Delete']) {
        const target = await boxOf(panelButton(page, name));
        expect(Math.min(target.width, target.height)).toBeGreaterThanOrEqual(touch ? 44 : 24);
      }
    });
  });
}

/** The row metadata that a panel's single-element figures make: "W × H · X, Y" and any turn. */
function rowOf(figures: readonly string[][]): string {
  const [x, y, width, height, angle] = figures.map(([, value]) => value ?? '');
  const turn = angle === '0°' ? [] : [angle];
  return [`${String(width)} × ${String(height)}`, `${String(x)}, ${String(y)}`, ...turn].join(
    ' · ',
  );
}

/** The rendered faces of an element's text, through the DevTools Protocol, as their families. */
async function facesOf(page: Page, selector: string): Promise<string[]> {
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  const { root } = await client.send('DOM.getDocument');
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
  await client.detach();
  return fonts.map(({ familyName }) => familyName);
}

test.describe('at 1280 × 720', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('D2 A2 the figures equal the open drawer’s row for the same element, before and after a turn by the handle', async ({
    page,
  }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    const row = (await openElements(page)).getByRole('option').first().locator('.element-row-meta');
    expect(rowOf(await figuresIn(page))).toBe(await row.textContent());
    // A quarter turn by the rotation handle, 24 px above the top centre of the rectangle, which
    // Enter drew 100 by 100 at the canvas's centre.
    const { width, height } = await canvasBox(page);
    await mouseDrag(page, [width / 2, height / 2 - 74], [width / 2 + 80, height / 2]);
    await expect(polite(page)).toHaveText('Rotated 1 rectangle. 1 element selected.');
    await expect.poll(async () => (await figuresIn(page))[4]).toEqual(['Angle', '90°']);
    expect(rowOf(await figuresIn(page))).toBe(await row.textContent());
  });

  test('D2 A2 Select all over three elements shows their count and the box of their turned bounds, with no angle', async ({
    page,
  }) => {
    await openPage(page);
    await onCanvas(page, ['r'], '');
    await mouseDrag(page, [400, 300], [520, 380]);
    // A quarter turn about the rectangle's centre, (460, 340), makes its bounds 80 by 120.
    await mouseDrag(page, [460, 276], [540, 340]);
    await expect(polite(page)).toHaveText('Rotated 1 rectangle. 1 element selected.');
    await page.keyboard.press('l');
    await mouseDrag(page, [600, 200], [650, 250]);
    await page.keyboard.press('o');
    await mouseDrag(page, [700, 400], [750, 420]);
    await page.keyboard.press('ControlOrMeta+A');
    await expect(polite(page)).toHaveText('3 elements selected.');
    await expect(selectionSurface(page).getByRole('heading')).toHaveText('3 elements');
    expect(await figuresIn(page)).toEqual([
      ['X', '420'],
      ['Y', '200'],
      ['W', '330'],
      ['H', '220'],
    ]);
  });

  test('D2 A3 a line shows its length, a dot its points and a two-line text its lines', async ({
    page,
  }) => {
    await openPage(page);
    await onCanvas(page, ['l', 'Enter'], 'Line created. 1 element selected.');
    expect(await figuresIn(page)).toContainEqual(['Length', '100']);
    await page.keyboard.press('p');
    await mouseClick(page, [300, 500]);
    await expect(polite(page)).toHaveText('Freehand stroke created. Nothing selected.');
    await page.keyboard.press('v');
    await mouseClick(page, [300, 500]);
    await expect(selectionSurface(page).getByRole('heading')).toHaveText('Freehand stroke');
    expect(await figuresIn(page)).toContainEqual(['Points', '1']);
    await drawText(page, ['Plan', 'week']);
    await expect(selectionSurface(page).getByRole('heading')).toHaveText('Text');
    expect(await figuresIn(page)).toContainEqual(['Lines', '2']);
  });

  test('D2 A3 the values are in JetBrains Mono, the heading, terms and actions in Inter at 400 or 500', async ({
    page,
  }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    const faces = await page.evaluate<Record<string, string[]>>(`(() => {
      const panel = document.querySelector('[data-island="selection"]');
      const of = (element) => getComputedStyle(element).fontFamily.split(',')[0].replaceAll('"', '') + ' ' + getComputedStyle(element).fontWeight;
      return {
        values: [...panel.querySelectorAll('dd')].map(of),
        terms: [...panel.querySelectorAll('dt')].map(of),
        words: [panel.querySelector('h2'), ...panel.querySelectorAll('button'), panel.querySelector('p')].map(of),
      };
    })()`);
    expect(new Set(faces['values'])).toEqual(new Set(['Planewright Mono 400']));
    expect(new Set(faces['terms'])).toEqual(new Set(['Planewright UI 500']));
    expect(faces['words']).toEqual([
      'Planewright UI 500',
      'Planewright UI 500',
      'Planewright UI 500',
      'Planewright UI 400',
    ]);
    expect(await facesOf(page, '[data-island="selection"] dd')).toEqual(['JetBrains Mono']);
    expect(await facesOf(page, '[data-island="selection"] h2')).toEqual(['Inter Medium']);
  });

  test('D2 REQ-C11 a press on the panel neither clears the selection nor creates an element, with a creation tool kept by tool lock', async ({
    page,
  }) => {
    await openPage(page);
    // Tool lock keeps the Rectangle tool with nothing selected; Select all selects the rectangle.
    await onCanvas(page, ['q', 'r', 'Enter'], 'Rectangle created. Nothing selected.');
    await onCanvas(page, ['ControlOrMeta+A'], '1 element selected.');
    await expect(toolButton(page, 'Rectangle')).toHaveAttribute('aria-pressed', 'true');
    await expect(selectionSurface(page)).toBeVisible();
    const panel = await boxOf(selectionSurface(page));
    // Its padding, mid-left edge, and its footnote.
    await page.mouse.click(panel.x + 2, panel.y + panel.height / 2);
    await selectionSurface(page).getByText('Style controls are not in this build.').click();
    await expect(elementsToggle(page).locator('.toggle-count')).toHaveText('1');
    await expect(selectionSurface(page).getByRole('heading')).toHaveText('Rectangle');
    await expect(polite(page)).toHaveText('1 element selected.');
    await onCanvas(page, ['q', 'v'], '1 element selected.');
    await page.mouse.click(panel.x + 2, panel.y + panel.height / 2);
    await expect(selectionSurface(page).getByRole('heading')).toHaveText('Rectangle');
    await expect(polite(page)).toHaveText('1 element selected.');
  });

  test('D5 nothing animates while the panel shows', async ({ page }) => {
    await openPage(page);
    await onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');
    await expect(selectionSurface(page)).toBeVisible();
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
  });
});
