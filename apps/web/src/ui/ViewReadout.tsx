import { useEditorView } from '../editor/surface.ts';

/** One decimal place, and never "-0". */
const decimal = (value: number): string => String(Math.round(value * 10) / 10 + 0);

/**
 * Where the view is: the scene point at the canvas's top-left corner and the zoom. An empty canvas
 * changes no pixel when it pans, so this is how panning and zooming show.
 */
export function ViewReadout() {
  const { camera } = useEditorView();
  const text = `View: x ${decimal(camera.x)}, y ${decimal(camera.y)}, zoom ${decimal(camera.zoom * 100)}%`;
  return (
    <p id="view-readout" className="view-readout">
      {text}
    </p>
  );
}
