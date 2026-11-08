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
 * The text area's place and font: the text's box on screen, one font size wider so that the caret
 * has room after the last character, turned about its centre by the text's rotation.
 */
export function textAreaStyle({ element, box }: EditedText, zoom: number): CSSProperties {
  const { font, align } = element.content;
  return {
    left: box.x,
    top: box.y,
    width: box.width + font.size * zoom,
    height: box.height,
    fontFamily: FONT_STACKS[font.family],
    fontSize: font.size * zoom,
    lineHeight: font.lineHeight,
    textAlign: align,
    color: element.style.stroke.color,
    transform: element.rotation === 0 ? undefined : `rotate(${String(element.rotation)}rad)`,
  };
}
