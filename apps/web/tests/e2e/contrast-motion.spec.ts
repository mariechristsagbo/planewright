import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { button, contrast, openElements, openPage, polite, textContrasts } from './a11y.ts';
import { glyphContrasts } from './glyphs.ts';
import { moreButton, toolButton } from './drawing.ts';
import { settled } from './motion.ts';
import { canvas, readout } from './support.ts';

/** The words that the controls showed before S3, which show glyphs instead (ADR 0012). */
const WORDS_NOW_GLYPHS = [
  'Hand',
  'Selection',
  'Rectangle',
  'Ellipse',
  'Diamond',
  'Line',
  'Freehand',
  'Text',
  'Tool lock',
  'Undo',
  'Redo',
  'Zoom out',
  'Zoom in',
  'Zoom to fit',
];

/** The palette's glyphs, which carry no word (ADR 0012, decision 3). */
const PALETTE = [
  'hand',
  'selection',
  'rectangle',
  'ellipse',
  'diamond',
  'line',
  'freehand',
  'text',
  'lock-open',
];

/**
 * Where A5 reads the glyphs: a desktop's 36 px glyph buttons, and the compact layout's 32 px ones,
 * where the corner key sits nearer its glyph and the mark shows without the wordmark.
 */
const GLYPH_VIEWPORTS = [
  { width: 1280, height: 720, button: 36 },
  { width: 800, height: 720, button: 32 },
] as const;

// Colour and motion on a desktop (ENG-14, docs/architecture/engine/quality.md#accessibility,
// REQ-Y06): every interface text meets 4.5:1 against what is behind it in the light theme, the
// only P0 theme, every glyph and the boundary of the control that shows it 3:1 (ADR 0012,
// decision 3), and with reduced motion requested a zoom shows its new view at once.

test('E4 A10 REQ-Y06 every interface text meets 4.5:1 contrast in the light theme', async ({
  page,
}) => {
  await openPage(page);
  // The tools, Undo, Redo and the zoom buttons but Reset zoom show glyphs rather than words (S3),
  // whose 3:1 the next test measures; this is read before anything is drawn, since the open
  // drawer's rows (S5) and the selection panel's heading (S6) name the elements' kinds in words.
  const atRest = (await textContrasts(page)).map(({ text }) => text);
  expect(atRest.filter((text) => WORDS_NOW_GLYPHS.includes(text))).toEqual([]);
  await canvas(page).focus();
  for (const key of ['r', 'Enter', 'o', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Ellipse created. 1 element selected.');
  await expect((await openElements(page)).getByRole('option')).toHaveCount(2);
  const contrasts = await textContrasts(page);
  // Every visible text, however many: P0's notes are in About this build now (ADR 0012, D5), the
  // open drawer adds its summary and its rows' labels and figures, and the selection panel its
  // heading, terms, values, actions and footnote (S6).
  const texts = contrasts.map(({ text }) => text);
  expect(texts).toEqual(
    expect.arrayContaining([
      'Pre-release',
      'Elements',
      '2',
      '100%',
      'Keys',
      'Ellipse',
      'Rectangle',
      'Angle',
      'Duplicate',
      'Delete',
      'Style controls are not in this build.',
    ]),
  );
  expect(contrasts.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
  // Delete's word in the error tone and the footnote in the muted text, on the surface (S6).
  const ratioOf = (text: string) => contrasts.find((each) => each.text === text)?.ratio;
  expect([ratioOf('Delete'), ratioOf('Style controls are not in this build.')]).toEqual([
    6.52, 5.5,
  ]);
});

test('A4 REQ-Y06 the open menu, its keys on a highlighted item, and Keyboard shortcuts keep every text at 4.5:1', async ({
  page,
}) => {
  await openPage(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Select all' })).toBeFocused();
  const menu = await textContrasts(page);
  expect(menu.map(({ text }) => text)).toEqual(
    expect.arrayContaining(['Select all', 'Ctrl+A', 'Show elements', 'Source on GitHub']),
  );
  expect(menu.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
  // The highlighted item's keys, muted text on the hover surface, are the closest to the floor.
  expect(menu.find(({ text }) => text === 'Ctrl+A')?.ratio).toBeLessThan(5);
  await page.keyboard.press('Escape');
  await button(page, 'Keyboard shortcuts').click();
  const dialog = await textContrasts(page);
  expect(dialog.map(({ text }) => text)).toEqual(
    expect.arrayContaining(['Keyboard shortcuts', 'Tools', 'Hand', 'Ctrl+Shift+Z', 'or']),
  );
  expect(dialog.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
});

test.describe('at a device pixel ratio of 2, so that a 1.5 px stroke covers whole pixels', () => {
  test.use({ deviceScaleFactor: 2 });

  for (const { width, height, button: size } of GLYPH_VIEWPORTS) {
    test.describe(`at ${String(width)} × ${String(height)}, with ${String(size)} px glyph buttons`, () => {
      test.use({ viewport: { width, height } });

      test('A5 every glyph and its control’s boundary meets 3:1 against its surface, computed and rendered', async ({
        page,
      }) => {
        await openPage(page);
        expect(await button(page, 'Hand').boundingBox()).toMatchObject({
          width: size,
          height: size,
        });
        await canvas(page).focus();
        for (const key of ['r', 'Enter']) await page.keyboard.press(key);
        await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
        const glyphs = await glyphContrasts(page);
        // The palette's tools and tool lock, the chosen one pressed, Undo enabled and Redo not,
        // the zoom buttons, Keyboard shortcuts, the menu button and the mark (ADR 0012, decision 3),
        // and the selection panel's heading, Duplicate and Delete, in the error tone (S6).
        expect(glyphs.map(({ glyph }) => glyph)).toEqual(
          expect.arrayContaining([
            ...PALETTE,
            'undo',
            'redo',
            'zoom-out',
            'zoom-in',
            'zoom-fit',
            'keyboard',
            'menu',
            'mark',
            'duplicate',
            'delete',
          ]),
        );
        expect(glyphs.filter(({ glyph }) => glyph === 'rectangle')).toHaveLength(2);
        expect(glyphs.find(({ control }) => control === 'Selection')).toBeDefined();
        const below = glyphs.filter(
          ({ computed, rendered, boundary }) =>
            computed < 3 || rendered < 3 || (boundary !== null && boundary < 3),
        );
        expect(below).toEqual([]);
      });
    });
  }
});

test.describe('on a phone, 390 × 844, at a device pixel ratio of 2', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  test('A10 the selection bar’s and the Details sheet’s texts meet 4.5:1 and their glyphs 3:1, Delete’s too', async ({
    page,
  }) => {
    await openPage(page);
    await canvas(page).focus();
    for (const key of ['r', 'Enter']) await page.keyboard.press(key);
    await expect(polite(page)).toHaveText('Rectangle created. 1 element selected.');
    const details = page
      .locator('[data-island="selection"]')
      .getByRole('button', { name: 'Details' });
    await details.tap();
    await expect(page.getByRole('region', { name: 'Details' })).toBeVisible();
    const contrasts = await textContrasts(page);
    expect(contrasts.map(({ text }) => text)).toEqual(
      expect.arrayContaining(['Rectangle', 'Angle', 'Style controls are not in this build.']),
    );
    expect(contrasts.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
    // The bar's and the sheet's glyphs: the bottom islands' and the dock's lie under the sheet,
    // inert, the dock's Rectangle among them (S8), so the kind's glyph shows twice, in the bar and in
    // the sheet's heading.
    const shown = ['rectangle', 'duplicate', 'delete', 'details', 'close'];
    const glyphs = (await glyphContrasts(page)).filter(
      ({ glyph, control }) => shown.includes(glyph) && control !== 'Rectangle',
    );
    expect(glyphs.map(({ glyph }) => glyph).sort()).toEqual(
      ['close', 'delete', 'details', 'duplicate', 'rectangle', 'rectangle'].sort(),
    );
    expect(glyphs.find(({ glyph }) => glyph === 'delete')?.computed).toBe(6.52);
    expect(
      glyphs.filter(
        ({ computed, rendered, boundary }) =>
          computed < 3 || rendered < 3 || (boundary !== null && boundary < 3),
      ),
    ).toEqual([]);
  });
});

test.describe('with the operating system asking for a dark scheme', () => {
  test.use({ colorScheme: 'dark' });

  const ACTIVE_OUTLINE = `(() => {
    const option = document.querySelector('[role="option"].active');
    const parse = (colour) => (colour.match(/[\\d.]+/g) || []).map(Number).slice(0, 3);
    let behind = option;
    while (behind !== null && /rgba\\(.*, 0\\)$|transparent/.test(getComputedStyle(behind).backgroundColor)) behind = behind.parentElement;
    return { outline: parse(getComputedStyle(option).outlineColor), background: parse(getComputedStyle(behind ?? document.documentElement).backgroundColor) };
  })()`;

  test('C4 C5 REQ-Y06 the page keeps its light theme, every interface text at 4.5:1 or more', async ({
    page,
  }) => {
    await openPage(page);
    expect(await page.evaluate("matchMedia('(prefers-color-scheme: dark)').matches")).toBe(true);
    const root = await page.evaluate<{ scheme: string; background: string }>(
      '({ scheme: getComputedStyle(document.documentElement).colorScheme, background: getComputedStyle(document.documentElement).backgroundColor })',
    );
    expect(root).toEqual({ scheme: 'light', background: 'rgb(249, 250, 251)' });
    await canvas(page).focus();
    for (const key of ['r', 'Enter', 'o', 'Enter']) await page.keyboard.press(key);
    const list = await openElements(page);
    await expect(list.getByRole('option')).toHaveCount(2);
    const contrasts = await textContrasts(page);
    // Undo and Redo show glyphs since S3 (ADR 0012's row for this line): texts that stay visible.
    expect(contrasts.map(({ text }) => text)).toEqual(expect.arrayContaining(['Elements', '100%']));
    expect(contrasts.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
    await list.focus();
    const { outline, background } = await page.evaluate<{
      outline: number[];
      background: number[];
    }>(ACTIVE_OUTLINE);
    expect(contrast(outline, background)).toBeGreaterThanOrEqual(3);
  });
});

test.describe('with reduced motion requested', () => {
  test.use({ reducedMotion: 'reduce' });

  test('E4 A11 REQ-Y06 a zoom changes the view in one step, and nothing animates, the menu and the drawer opened', async ({
    page,
  }) => {
    await openPage(page);
    expect(await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")).toBe(
      true,
    );
    const frames = await page.evaluate<string[]>(`new Promise((resolve) => {
      const seen = [];
      document.querySelector('[aria-label="Zoom"] button:nth-of-type(3)').click();
      const sample = () => {
        seen.push(document.getElementById('view-readout').textContent);
        if (seen.length < 10) requestAnimationFrame(sample); else resolve(seen);
      };
      requestAnimationFrame(sample);
    })`);
    const [zoomed] = frames;
    expect([new Set(frames).size, zoomed]).toEqual([1, expect.stringMatching(/, zoom 110%$/u)]);
    await button(page, /^Reset zoom/u).click();
    await expect(readout(page)).toHaveText(/, zoom 100%$/u);
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
    // ADR 0012's row for this line: always empty under reduced motion, surfaces opened (S12).
    await button(page, 'Planewright menu').click();
    await expect(page.getByRole('menu', { name: 'Planewright menu' })).toBeVisible();
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
    await openElements(page);
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
  });

  test.describe('on a phone, 390 × 844', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('E4 A11 nothing animates as the Elements sheet opens', async ({ page }) => {
      await openPage(page);
      await openElements(page);
      await expect(page.locator('#element-list-drawer')).toBeVisible();
      expect(await page.evaluate('document.getAnimations().length')).toBe(0);
    });
  });
});

test.describe('on a phone, 390 × 844, at a device pixel ratio of 2, with More open', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  /** More's glyphs and its items', with every one under 3:1 by its paint, its pixels or its edge. */
  async function moreGlyphs(page: Page) {
    const glyphs = (await glyphContrasts(page)).filter(({ control }) =>
      ['More', 'Hand', 'Diamond', 'Tool lock'].includes(control ?? ''),
    );
    const below = glyphs.filter(
      ({ computed, rendered, boundary }) =>
        computed < 3 || rendered < 3 || (boundary !== null && boundary < 3),
    );
    return { glyphs: glyphs.map(({ control, glyph }) => `${control ?? ''} ${glyph}`), below };
  }

  // reduced-motion.spec.ts's "A2 More’s popover shows at once" checks that nothing animates at any
  // time under reduced motion.
  test('A13 every text, the corner keys included, meets 4.5:1, More’s and its items’ glyphs 3:1 at rest and pressed, and nothing animates once More’s entrance ends', async ({
    page,
  }) => {
    await openPage(page);
    await moreButton(page).tap();
    await expect(moreButton(page)).toHaveAttribute('aria-expanded', 'true');
    const texts = await textContrasts(page);
    expect(texts.map(({ text }) => text)).toEqual(expect.arrayContaining(['H', 'D', 'Q', 'V']));
    expect(texts.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
    expect(await moreGlyphs(page)).toEqual({
      glyphs: ['More more', 'Hand hand', 'Diamond diamond', 'Tool lock lock-open'],
      below: [],
    });
    await settled(page);
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
    await toolButton(page, 'Diamond').tap();
    await expect(moreButton(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await moreGlyphs(page)).toEqual({ glyphs: ['More diamond'], below: [] });
    await settled(page);
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
  });
});
