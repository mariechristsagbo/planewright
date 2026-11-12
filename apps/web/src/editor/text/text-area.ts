import type { EditorView } from '@planewright/engine';
import { FONT_STACKS } from '@planewright/render-canvas';
import type { CSSProperties } from 'react';

import type { Platform } from '../../platform/platform.ts';
import { shortcutText } from '../../ui/shortcuts.ts';

// The text area's rules: which keys end a session, where and in which font it shows the text, and
// where its hint chip lies and which keys it names (the v0.2 plan's S9).

type EditedText = NonNullable<EditorView['text']>;

/** The hint chip's identifier, which describes the text area while it shows. */
export const HINT_ID = 'text-editor-hint';

/** The chip's gap under the text area, the chrome's small spacing (--pw-spacing-sm). */
const HINT_GAP = 8;

/** The parts of a key press that decide whether it ends the session. */
interface KeyPress {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly isComposing: boolean;
  readonly keyCode: number;
}

/**
 * Whether a key press in the text area ends the session: Escape, or Mod+Enter (REQ-V05), but never
 * while an input method composes, whose keys those then are; Safari marks them only by code 229.
 */
export function endsSession(event: KeyPress, platform: Platform): boolean {
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.key === 'Escape') return true;
  return event.key === 'Enter' && (platform === 'apple' ? event.metaKey : event.ctrlKey);
}

/**
 * The text area's place and font: the text's box on screen, turned about that box's centre by the
 * text's rotation, as the canvas turns it. The caret's room after the last character, one font
 * size, is padding on the trailing side, so the text keeps its box whatever its alignment.
 */
export function textAreaStyle({ element, box }: EditedText, zoom: number): CSSProperties {
  const { font, align } = element.content;
  const caret = font.size * zoom;
  return {
    left: box.x,
    top: box.y,
    width: box.width + caret,
    height: box.height,
    paddingRight: caret,
    fontFamily: FONT_STACKS[font.family],
    fontSize: font.size * zoom,
    lineHeight: font.lineHeight,
    textAlign: align,
    color: element.style.stroke.color,
    transform: element.rotation === 0 ? undefined : `rotate(${String(element.rotation)}rad)`,
    transformOrigin: `${String(box.width / 2)}px ${String(box.height / 2)}px`,
  };
}

/**
 * Where the hint chip lies: 8 px under the axis-aligned bounds of the text area as drawn, at their
 * left. The text area is the text's box widened by the caret's room, turned about the box's centre
 * by the text's rotation, as textAreaStyle places it; the chip itself is never turned or zoomed.
 */
export function hintPlace(
  { element, box }: EditedText,
  zoom: number,
): { left: number; top: number } {
  const caret = element.content.font.size * zoom;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const [cos, sin] = [Math.cos(element.rotation), Math.sin(element.rotation)];
  const corners = [box.x, box.x + box.width + caret].flatMap((x) =>
    [box.y, box.y + box.height].map((y) => ({
      x: cx + (x - cx) * cos - (y - cy) * sin,
      y: cy + (x - cx) * sin + (y - cy) * cos,
    })),
  );
  return {
    left: Math.min(...corners.map(({ x }) => x)),
    top: Math.max(...corners.map(({ y }) => y)) + HINT_GAP,
  };
}

/** The keys that the hint chip names, as people read them: Escape, then Enter with the Mod key. */
export const finishKeys = (platform: Platform): readonly [escape: string, enter: string] => [
  shortcutText([{ key: 'escape' }], platform),
  shortcutText([{ key: 'enter', mod: true }], platform),
];
