import type { FontFamily } from '@planewright/engine';
import { canvasFont } from '@planewright/render-canvas';

// The bundled fonts behind the three families (ADR 0011), declared in styles/fonts.css. The page
// loads them before it creates the editor, so that the first text is measured in its font.

const FAMILIES: readonly FontFamily[] = ['sans', 'hand', 'mono'];

/** The part of `document.fonts` that loads a font. */
export type FontLoader = Pick<FontFaceSet, 'load'>;

/** Loads the face of each family; a face that fails to load leaves its generic fallback. */
export async function loadFonts(fonts: FontLoader): Promise<void> {
  await Promise.allSettled(
    FAMILIES.map((family) => fonts.load(canvasFont({ family, size: 20, lineHeight: 1 }))),
  );
}
