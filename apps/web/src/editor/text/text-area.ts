import type { EditorView } from '@planewright/engine';
import { FONT_STACKS } from '@planewright/render-canvas';
import type { CSSProperties } from 'react';

import type { Platform } from '../../platform/platform.ts';

// The text area's rules: which keys end a session, and where and in which font it shows the text.

type EditedText = NonNullable<EditorView['text']>;

/** Whether a key press in the text area ends the session: Escape, or Mod+Enter (REQ-V05). */
export function endsSession(
  event: { readonly key: string; readonly ctrlKey: boolean; readonly metaKey: boolean },
  platform: Platform,
): boolean {
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
