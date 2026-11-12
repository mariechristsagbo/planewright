import type { Page } from '@playwright/test';

import { contrast } from './a11y.ts';
import { settled } from './motion.ts';

// Readings of the chrome's original glyphs from a real render (ADR 0012, decision 3): glyphs and
// control boundaries carry 3:1 against the surface they sit on. Each glyph is read twice, from the
// colours that the page computes for its shapes and from the pixels of a screenshot. Page code is
// written as strings, since these files compile without the DOM library.

/**
 * Every visible glyph, with the paint of each of its shapes blended by its opacities over the
 * opaque background behind the glyph, the box of its live area, inside the grid's 2 px margin, and
 * the border of the control that shows it against the surface around that control.
 */
const GLYPHS = `(() => {
  const parse = (colour) => (colour.match(/[\\d.]+/g) || []).map(Number);
  const clear = (colour) => colour === 'none' || colour === 'transparent' || (parse(colour).length === 4 && parse(colour)[3] === 0);
  const backgroundOf = (element) => {
    for (let at = element; at !== null; at = at.parentElement) {
      const colour = getComputedStyle(at).backgroundColor;
      if (!clear(colour)) return parse(colour).slice(0, 3);
    }
    return [255, 255, 255];
  };
  const opacityOf = (element) => {
    let opacity = 1;
    for (let at = element; at !== null; at = at.parentElement) opacity *= Number(getComputedStyle(at).opacity);
    return opacity;
  };
  const blend = (colour, alpha, background) => colour.slice(0, 3).map((channel, index) => channel * alpha + background[index] * (1 - alpha));
  const glyphs = [];
  for (const svg of document.querySelectorAll('svg[data-glyph]')) {
    const box = svg.getBoundingClientRect();
    if (box.width <= 1 || getComputedStyle(svg).visibility === 'hidden') continue;
    const background = backgroundOf(svg.parentElement);
    const paints = [...svg.children].map((shape) => {
      const style = getComputedStyle(shape);
      const stroked = !clear(style.stroke);
      const [r, g, b, a = 1] = parse(stroked ? style.stroke : style.fill);
      const alpha = a * Number(stroked ? style.strokeOpacity : style.fillOpacity) * opacityOf(svg);
      return blend([r, g, b], alpha, background);
    });
    const control = svg.closest('button');
    const edge = control === null ? null : getComputedStyle(control);
    const border = edge === null || edge.borderTopStyle === 'none' || parseFloat(edge.borderTopWidth) === 0 || clear(edge.borderTopColor)
      ? null
      : { colour: parse(edge.borderTopColor), surface: backgroundOf(control.parentElement) };
    const scale = box.width / 20;
    const live = { x: box.x + 2 * scale, y: box.y + 2 * scale, width: 16 * scale, height: 16 * scale };
    glyphs.push({ glyph: svg.dataset.glyph, control: control?.getAttribute('aria-label') ?? null, paints, background, live, border });
  }
  return glyphs;
})()`;

interface Glyph {
  readonly glyph: string;
  readonly control: string | null;
  readonly paints: number[][];
  readonly background: number[];
  readonly live: { x: number; y: number; width: number; height: number };
  readonly border: { colour: number[]; surface: number[] } | null;
}

/** The highest contrast that any pixel of a PNG has against a background, decoded in the page. */
const PIXELS = (png: string, background: readonly number[]) => `(async () => {
  const image = new Image();
  image.src = 'data:image/png;base64,${png}';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, image.width, image.height);
  const linear = (value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const luminance = (r, g, b) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  const behind = luminance(...${JSON.stringify(background)});
  let best = 1;
  for (let index = 0; index < data.length; index += 4) {
    const pixel = luminance(data[index], data[index + 1], data[index + 2]);
    const [light, dark] = pixel > behind ? [pixel, behind] : [behind, pixel];
    best = Math.max(best, (light + 0.05) / (dark + 0.05));
  }
  return best;
})()`;

export interface GlyphContrast {
  readonly glyph: string;
  readonly control: string | null;
  /** The lowest contrast of the glyph's shapes, from their computed paint. */
  readonly computed: number;
  /** The highest contrast of the glyph's live area's pixels, from a screenshot. */
  readonly rendered: number;
  /** The contrast of the control's border against the surface around it, if it has one. */
  readonly boundary: number | null;
}

const rounded = (ratio: number): number => Math.round(ratio * 100) / 100;

/** Every visible glyph's contrast against what is behind it, computed and rendered. */
export async function glyphContrasts(page: Page): Promise<GlyphContrast[]> {
  await settled(page);
  const glyphs = await page.evaluate<Glyph[]>(GLYPHS);
  const results: GlyphContrast[] = [];
  for (const { glyph, control, paints, background, live, border } of glyphs) {
    const png = await page.screenshot({ clip: live, animations: 'disabled' });
    const rendered = await page.evaluate<number>(PIXELS(png.toString('base64'), background));
    results.push({
      glyph,
      control,
      computed: rounded(Math.min(...paints.map((paint) => contrast(paint, background)))),
      rendered: rounded(rendered),
      boundary: border === null ? null : rounded(contrast(border.colour, border.surface)),
    });
  }
  return results;
}
