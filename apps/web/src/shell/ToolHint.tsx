import { useViewValue } from '../editor/surface.ts';
import { hintOf } from './tool-hints.ts';

/**
 * The active tool's hint line under the palette (ADR 0012, decision 1; the v0.2 plan's S10): plain
 * text, neither announced nor described by, since the palette's pressed tool already says the tool,
 * and nothing while a text is edited. It reads the tool and whether a text is edited alone, which
 * keep their identity across camera steps and typed values, so neither renders it.
 */
export function ToolHint() {
  const tool = useViewValue((view) => view.tool);
  const editing = useViewValue((view) => view.text !== null);
  if (editing) return null;
  return (
    <p id="tool-hint" className="tool-hint">
      {hintOf(tool)}
    </p>
  );
}
