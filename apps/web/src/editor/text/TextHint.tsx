import type { EditorView } from '@planewright/engine';

import { useSurface } from '../surface.ts';
import { finishKeys, HINT_ID, hintPlace } from './text-area.ts';

/**
 * The text area's hint chip (the v0.2 plan's S9): a caption under the text area that names the keys
 * that end the session, each in a key chip, and describes the text area. It is no control, live
 * region or tooltip, and a press on it goes through to the canvas (styles/text-session.css).
 */
export function TextHint({
  text,
  zoom,
}: {
  readonly text: NonNullable<EditorView['text']>;
  readonly zoom: number;
}) {
  const { platform } = useSurface();
  const [escape, enter] = finishKeys(platform);
  return (
    <p id={HINT_ID} className="text-hint" style={hintPlace(text, zoom)}>
      Finish with <kbd>{escape}</kbd> or <kbd>{enter}</kbd>
    </p>
  );
}
